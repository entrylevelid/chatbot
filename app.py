# app.py
from flask import Flask, render_template, request, Response, copy_current_request_context, jsonify, stream_with_context, redirect, url_for, session
from werkzeug.utils import secure_filename
from rag_handler import RAGHandler
import ollama
import json
import traceback
import os
import time
import logging
from functools import wraps

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = os.path.join(os.getcwd(), UPLOAD_FOLDER)

# Ensure upload folder exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Initialize RAG handler
rag_handler = RAGHandler()

def allowed_file(filename):
    # Updated to allow Excel files
    allowed_extensions = {'pdf', 'xlsx', 'xls'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions

def generate_response(message, model, context):
    """Generate streaming response using Ollama model and context"""
    system_prompt = """You are a helpful AI assistant named Xypher. Important rules:
    1. NEVER hallucinate or imagine context that wasn't provided
    2. NEVER mention anything about contexts or documents unless they are explicitly provided
    3. When no context is provided, simply answer questions directly without mentioning anything about documents or context
    4. Keep responses clear and natural
    5. Format code blocks using markdown when needed
    """
    
    # Lebih eksplisit dalam menangani konteks kosong
    if not context.strip() or context == "No relevant context found.":
        user_prompt = f"QUESTION: {message}"
    else:
        user_prompt = f"""CONTEXT: {context}
        QUESTION: {message}"""

    # Check if context is empty or indicates no relevant context
    is_empty_context = not context.strip() or context == "No relevant context found."
    
    # Create user prompt combining context and question
    user_prompt = f"""CONTEXT BEGINS
    {context if not is_empty_context else "NO CONTEXT AVAILABLE"}
    CONTEXT ENDS

    QUESTION: {message}

    Instructions:
    1. If context was provided between CONTEXT BEGINS and CONTEXT ENDS, use ONLY that information
    2. If you see "NO CONTEXT AVAILABLE", start with "I am using my general knowledge..."
    3. Be direct and concise in your response
    """

    try:
        logger.debug(f"Generating response with model: {model}")
        logger.debug(f"Context empty: {is_empty_context}")
        logger.debug(f"Context preview: {context[:200] if not is_empty_context else 'NO CONTEXT'}")
        
        # Stream response from Ollama
        response_stream = ollama.chat(
            model=model,
            messages=[
                {
                    'role': 'system',
                    'content': system_prompt
                },
                {
                    'role': 'user',
                    'content': user_prompt
                }
            ],
            stream=True
        )

        # Initialize response buffer
        current_response = ""
        
        # Stream each chunk
        for chunk in response_stream:
            if 'message' in chunk:
                content = chunk['message'].get('content', '')
                current_response += content
                
                # Send chunk to client
                yield f"data: {json.dumps({'status': 'chunk', 'content': current_response})}\n\n"

        # Send completion message
        yield f"data: {json.dumps({'status': 'done'})}\n\n"

    except Exception as e:
        logger.error(f"Error in generate_response: {str(e)}", exc_info=True)
        error_msg = f"Error generating response: {str(e)}"
        yield f"data: {json.dumps({'status': 'error', 'message': error_msg})}\n\n"

# Add Flask secret key for session management
app.secret_key = '4d1214nh'  # Change this to a secure secret key

@app.route('/')
def home():
    if 'user_name' not in session:
        return redirect(url_for('login'))
    return render_template('index.html', user_name=session['user_name'])

@app.route('/login')
def login():
    return render_template('login.html')

@app.route('/submit-name', methods=['POST'])
def submit_name():
    session['user_name'] = request.form['nama']
    return redirect(url_for('home'))

@app.route('/chat', methods=['POST'])
def chat():
    try:
        message = request.form.get('message', '')
        model = request.form.get('model', 'deepseek-r1:7b')
        
        logger.debug(f"Received chat request - Message: {message}, Model: {model}")
        
        if 'files' in request.files:
            files = request.files.getlist('files')
            for file in files:
                if file and allowed_file(file.filename):
                    filename = secure_filename(file.filename)
                    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    file.save(filepath)
                    
                    logger.debug(f"Processing file: {filename}")
                    # Use the new process_file method instead of process_pdf
                    success = rag_handler.process_file(filepath)
                    if not success:
                        logger.error(f"Failed to process file: {filename}")
                        return jsonify({
                            'status': 'error',
                            'message': f'Error processing {filename}'
                        })
                    
                    # Remove file after processing
                    os.remove(filepath)
        
        # Get relevant context for the query
        relevant_context = rag_handler.get_relevant_context(message)
        context_text = "\n".join(relevant_context) if relevant_context else "No relevant context found."
        
        logger.debug(f"Retrieved context length: {len(context_text)}")
        
        return Response(
            stream_with_context(generate_response(message, model, context_text)),
            mimetype='text/event-stream'
        )
        
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}", exc_info=True)
        return jsonify({
            'status': 'error',
            'message': str(e)
        })

@app.route('/clear-context', methods=['POST'])
def clear_context():
    """Endpoint to clear the vector store"""
    try:
        logger.debug("Attempting to clear vector store")
        rag_handler.clear_vector_store()
        return jsonify({'status': 'success', 'message': 'Context cleared successfully'})
    except Exception as e:
        logger.error(f"Error clearing vector store: {str(e)}", exc_info=True)
        return jsonify({'status': 'error', 'message': str(e)})

if __name__ == '__main__':
    app.run(debug=False)