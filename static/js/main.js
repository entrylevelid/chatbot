// static/js/main.js
const modelSelect = document.getElementById('model-select');

document.addEventListener('DOMContentLoaded', function() {
    const messagesContainer = document.getElementById('messages');
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const welcomeText = document.querySelector('.welcome-text');
    const chatCard = document.querySelector('.chat-card');
    const pdfUpload = document.getElementById('pdf-upload');
    const attachButton = document.getElementById('attach-button');
    const clearButton = document.querySelector('.clear-button');
    let attachedFiles = new Set();

    // Handle clear context
    clearButton.addEventListener('click', async () => {
        try {
            const response = await fetch('/clear-context', {
                method: 'POST'
            });
            const data = await response.json();
            
            if (data.status === 'success') {
                // Optional: Add message to chat
                addMessage('assistant', 'Context has been cleared. You can upload new documents.');
            } else {
                console.error('Error clearing context:', data.message);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    });

    // Trigger file input when attach button is clicked
    attachButton.addEventListener('click', () => {
        pdfUpload.click();
    });

    // Handle file selection
    pdfUpload.addEventListener('change', function(e) {
        const files = Array.from(e.target.files);
        
        // Create or get file preview container
        let previewContainer = document.querySelector('.file-preview');
        if (!previewContainer) {
            previewContainer = document.createElement('div');
            previewContainer.className = 'file-preview';
            document.querySelector('.input-container').insertBefore(
                previewContainer, 
                document.querySelector('.input-row')
            );
        }

        files.forEach(file => {
            if (file.type === 'application/pdf' || 
                file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                file.type === 'application/vnd.ms-excel') {
                
                attachedFiles.add(file);
                
                // Create preview item
                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.innerHTML = `
                    <span>${file.name}</span>
                    <button type="button" class="remove-file">×</button>
                `;
                
                // Handle remove button
                fileItem.querySelector('.remove-file').onclick = () => {
                    attachedFiles.delete(file);
                    fileItem.remove();
                    if (attachedFiles.size === 0) {
                        previewContainer.remove();
                    }
                };
                
                previewContainer.appendChild(fileItem);
            }
        });
    });

    // Enable/disable send button based on input
    userInput.addEventListener('input', function() {
        sendButton.disabled = !this.value.trim();
    });

    // Handle form submission
    chatForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const message = userInput.value.trim();
        if (!message && attachedFiles.size === 0) return;

        // Create FormData to send files
        const formData = new FormData();
        formData.append('message', message);
        formData.append('model', modelSelect.value);
        
        // Append each file
        attachedFiles.forEach(file => {
            formData.append('files', file);
        });

        // Clear attached files
        attachedFiles.clear();
        const previewContainer = document.querySelector('.file-preview');
        if (previewContainer) {
            previewContainer.remove();
        }

        // Hide welcome container (includes both text and hand icon) and expand chat card
        const welcomeContainer = document.querySelector('.welcome-container');
        if (welcomeContainer) {
            welcomeContainer.style.display = 'none';
        }
        chatCard.classList.add('expanded');

        // Add user message to chat
        addMessage('user', message);
        userInput.value = '';
        sendButton.disabled = true;

        // Create and show typing indicator
        const typingIndicator = createTypingIndicator();
        typingIndicator.style.display = 'block';

        try {
            // Create response container for assistant
            const responseContainer = createResponseContainer();
            responseContainer.style.display = 'none'; // Hide initially
            let fullResponse = '';
            
            // Send request to server
            const response = await fetch('/chat', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Read response as stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = ''; // Add buffer for incomplete chunks

            while (true) {
                const { value, done } = await reader.read();
                
                if (done) {
                    console.log('Stream complete');
                    sendButton.disabled = false;
                    // Remove typing indicator when done
                    typingIndicator.remove();
                    responseContainer.style.display = 'block';
                    scrollToBottom();
                    break;
                }

                // Show response container and hide typing indicator on first chunk
                if (fullResponse === '') {
                    typingIndicator.remove();
                    responseContainer.style.display = 'block';
                }

                // Decode and handle buffer
                buffer += decoder.decode(value, { stream: true });
                
                // Process complete lines
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            
                            if (data.status === 'chunk') {
                                // Replace entire content instead of appending
                                fullResponse = data.content;
                                
                                // Create copy button for streaming response
                                const copyButton = document.createElement('button');
                                copyButton.className = 'copy-button';
                                copyButton.textContent = 'Copy';
                                copyButton.onclick = async function() {
                                    try {
                                        await navigator.clipboard.writeText(fullResponse);
                                        copyButton.textContent = 'Copied!';
                                        copyButton.classList.add('copied');
                                        setTimeout(() => {
                                            copyButton.textContent = 'Copy';
                                            copyButton.classList.remove('copied');
                                        }, 2000);
                                    } catch (err) {
                                        console.error('Failed to copy:', err);
                                    }
                                };

                                // Process code blocks
                                if (fullResponse.includes('```')) {
                                    let parts = fullResponse.split('```');
                                    let formattedContent = '';
                                    
                                    parts.forEach((part, index) => {
                                        if (index % 2 === 0) {
                                            formattedContent += part;
                                        } else {
                                            let code = part.trim();
                                            let language = 'plaintext';
                                            
                                            if (code.includes('\n')) {
                                                let firstLine = code.split('\n')[0];
                                                if (firstLine) {
                                                    language = firstLine;
                                                    code = code.split('\n').slice(1).join('\n');
                                                }
                                            }
                                            
                                            formattedContent += `<pre class="line-numbers"><code class="language-${language}">${escapeHTML(code)}</code></pre>`;
                                        }
                                    });
                                    
                                    responseContainer.innerHTML = formattedContent;
                                } else {
                                    responseContainer.textContent = fullResponse;
                                }

                                responseContainer.appendChild(copyButton);
                                
                                // Highlight code blocks
                                responseContainer.querySelectorAll('pre code').forEach((block) => {
                                    Prism.highlightElement(block);
                                });
                                
                                scrollToBottom();
                            }
                        } catch (e) {
                            console.error('Error parsing SSE data:', e, 'Line:', line);
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Fetch error:', error);
            addMessage('assistant', `Error: ${error.message}`);
            typingIndicator.remove();
            sendButton.disabled = false;
        }
    });

    function createTypingIndicator() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant';
        
        const indicatorDiv = document.createElement('div');
        indicatorDiv.className = 'typing-indicator message-content';
        indicatorDiv.innerHTML = 'Fluffy is typing<span>.</span><span>.</span><span>.</span>';
        
        messageDiv.appendChild(indicatorDiv);
        messagesContainer.appendChild(messageDiv);
        
        scrollToBottom();
        return messageDiv;
    }

    function createResponseContainer() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        messageDiv.appendChild(contentDiv);
        messagesContainer.appendChild(messageDiv);
        
        return contentDiv;
    }

    function addMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // Tambahkan tombol copy
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button';
        copyButton.textContent = 'Copy';
        copyButton.onclick = async function() {
            try {
                // Dapatkan teks murni dari konten
                const textToCopy = content;
                await navigator.clipboard.writeText(textToCopy);
                
                // Feedback visual
                copyButton.textContent = 'Copied!';
                copyButton.classList.add('copied');
                
                // Reset setelah 2 detik
                setTimeout(() => {
                    copyButton.textContent = 'Copy';
                    copyButton.classList.remove('copied');
                }, 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
                copyButton.textContent = 'Failed!';
                setTimeout(() => {
                    copyButton.textContent = 'Copy';
                }, 2000);
            }
        };

        // Check if content contains code blocks
        if (content.includes('```')) {
            let parts = content.split('```');
            let formattedContent = '';
            
            parts.forEach((part, index) => {
                if (index % 2 === 0) {
                    // Regular text
                    formattedContent += part;
                } else {
                    // Code block
                    let code = part.trim();
                    let language = 'plaintext';
                    
                    // Check for language specification
                    if (code.includes('\n')) {
                        let firstLine = code.split('\n')[0];
                        if (firstLine) {
                            language = firstLine;
                            code = code.split('\n').slice(1).join('\n');
                        }
                    }
                    
                    formattedContent += `<pre class="line-numbers"><code class="language-${language}">${escapeHTML(code)}</code></pre>`;
                }
            });
            
            contentDiv.innerHTML = formattedContent;
        } else {
            contentDiv.textContent = content;
        }
        
        contentDiv.appendChild(copyButton);
        messageDiv.appendChild(contentDiv);
        messagesContainer.appendChild(messageDiv);
        
        // Highlight code blocks
        messageDiv.querySelectorAll('pre code').forEach((block) => {
            Prism.highlightElement(block);
        });
        
        // Add anchor and scroll
        const anchor = document.createElement('div');
        anchor.className = 'scroll-anchor';
        messagesContainer.appendChild(anchor);
        anchor.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Helper function to escape HTML
    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag]));
    }

    function scrollToBottom() {
        const lastMessage = messagesContainer.lastElementChild;
        if (lastMessage) {
            lastMessage.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }

    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 150) + 'px';
    });
});