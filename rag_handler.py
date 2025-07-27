# rag_handler.py
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.document_loaders import UnstructuredExcelLoader  # Import untuk Excel
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
import os
import logging

os.environ['KMP_DUPLICATE_LIB_OK']='TRUE'  # Fix for OpenMP error
# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class RAGHandler:
    def __init__(self):
        logger.debug("Initializing RAGHandler")
        self.embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={'device': 'cuda'}
        )
        
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=50,
            length_function=len
        )
        
        self.vector_store_path = "vector_store"
        self.vector_store = self._initialize_vector_store()

    def _initialize_vector_store(self):
        """Initialize or load existing vector store"""
        try:
            if os.path.exists(self.vector_store_path):
                return FAISS.load_local(
                    self.vector_store_path, 
                    self.embeddings,
                    allow_dangerous_deserialization=True
                )
            return None
        except Exception as e:
            print(f"Error loading vector store: {str(e)}")
            if os.path.exists(self.vector_store_path):
                import shutil
                shutil.rmtree(self.vector_store_path)
            return None

    def process_file(self, file_path):
        """Process a PDF or Excel file"""
        try:
            file_extension = os.path.splitext(file_path)[1].lower()
            
            if file_extension == '.pdf':
                return self._process_pdf(file_path)
            elif file_extension in ['.xlsx', '.xls']:
                return self._process_excel(file_path)
            else:
                logger.error(f"Unsupported file type: {file_extension}")
                return False
                
        except Exception as e:
            logger.error(f"Error processing file {file_path}: {str(e)}", exc_info=True)
            return False
    
    def _process_pdf(self, pdf_path):
        """Process a single PDF file"""
        try:
            logger.debug(f"Processing PDF: {pdf_path}")
            loader = PyPDFLoader(pdf_path)
            pages = loader.load()
            
            logger.debug(f"Number of pages loaded: {len(pages)}")
            chunks = self.text_splitter.split_documents(pages)
            logger.debug(f"Number of chunks created: {len(chunks)}")
            
            self._add_to_vector_store(chunks)
            return True
            
        except Exception as e:
            logger.error(f"Error processing PDF {pdf_path}: {str(e)}", exc_info=True)
            return False
    
    def _process_excel(self, excel_path):
        """Process a single Excel file"""
        try:
            logger.debug(f"Processing Excel: {excel_path}")
            loader = UnstructuredExcelLoader(excel_path, mode="elements")
            documents = loader.load()
            
            logger.debug(f"Number of elements loaded: {len(documents)}")
            chunks = self.text_splitter.split_documents(documents)
            logger.debug(f"Number of chunks created: {len(chunks)}")
            
            self._add_to_vector_store(chunks)
            return True
            
        except Exception as e:
            logger.error(f"Error processing Excel {excel_path}: {str(e)}", exc_info=True)
            return False
    
    def _add_to_vector_store(self, chunks):
        """Add chunks to vector store"""
        if self.vector_store is None:
            logger.debug("Creating new vector store")
            self.vector_store = FAISS.from_documents(chunks, self.embeddings)
        else:
            logger.debug("Adding to existing vector store")
            self.vector_store.add_documents(chunks)
        
        self.vector_store.save_local(self.vector_store_path)
        logger.debug("Vector store saved successfully")

    # Backward compatibility for process_pdf
    def process_pdf(self, pdf_path):
        """Legacy method for processing PDF files"""
        return self._process_pdf(pdf_path)

    def get_relevant_context(self, query, k=3):
        """Retrieve relevant context for a query"""
        if self.vector_store is None:
            logger.warning("Vector store is None, returning empty context")
            return []
            
        try:
            logger.debug(f"Searching for context with query: {query}")
            docs = self.vector_store.similarity_search(query, k=k)
            contexts = [doc.page_content for doc in docs]
            logger.debug(f"Found {len(contexts)} relevant contexts")
            logger.debug(f"First context: {contexts[0] if contexts else 'None'}")
            return contexts
        except Exception as e:
            logger.error(f"Error retrieving context: {str(e)}", exc_info=True)
            return []

    def clear_vector_store(self):
        """Clear the vector store"""
        try:
            if os.path.exists(self.vector_store_path):
                import shutil
                shutil.rmtree(self.vector_store_path)
            self.vector_store = None
            return True
        except Exception as e:
            print(f"Error clearing vector store: {str(e)}")
            return False