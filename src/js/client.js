import { updateTheme } from './theme.js';

document.addEventListener('DOMContentLoaded', () => {
  const messageInput = document.getElementById('message-input');
  const sendButton = document.getElementById('send-button');
  const messagesContainer = document.getElementById('messages-container');
  const emptyState = document.querySelector('.empty-state');
  const attachmentButton = document.getElementById('attachment-button');
  const imageInput = document.getElementById('image-input');
  const infoButton = document.getElementById('info-button');
  const infoModal = document.getElementById('info-modal');
  const closeModalButton = document.querySelector('.close-modal');
  const newChatButton = document.getElementById('new-chat-button');
  let currentImage = null;

  // Helper function to get time of day
  function getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }

  // Function to reset chat
  function resetChat() {
    // Clear messages
    messagesContainer.innerHTML = '';

    // Reset input and current image
    messageInput.value = '';
    currentImage = null;

    // Remove any image preview
    const previewContainer = document.querySelector('.image-preview-container');
    if (previewContainer) {
      previewContainer.remove();
    }

    // Reattach example pill listeners
    document.querySelectorAll('.example-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        messageInput.value = pill.textContent;
        processMessage();
      });
    });
  }

  // Add event listener for new chat button
  newChatButton.addEventListener('click', () => window.location.reload());

  // Close modal on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && infoModal.classList.contains('show')) {
      closeModal();
    }
  });

  // Set greeting based on time of day
  const hour = new Date().getHours();
  const greeting = document.querySelector('.empty-state-greeting');
  if (greeting) {
    if (hour >= 5 && hour < 12) {
      greeting.textContent = 'Good morning! 🌅';
    } else if (hour >= 12 && hour < 17) {
      greeting.textContent = 'Good afternoon! ☀️';
    } else if (hour >= 17 && hour < 22) {
      greeting.textContent = 'Good evening! 🌆';
    } else {
      greeting.textContent = 'Good night! 🌙';
    }
  }

  // Handle example pill clicks
  document.querySelectorAll('.example-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      messageInput.value = pill.textContent;
      processMessage();
    });
  });

  let typingIndicator = null;

  function createTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';
    return indicator;
  }

  function showTypingIndicator() {
    // Remove any existing typing indicator
    if (typingIndicator) {
      typingIndicator.remove();
    }
    // Create new typing indicator
    typingIndicator = createTypingIndicator();
    messagesContainer.appendChild(typingIndicator);
    // Add visible class after a small delay to ensure smooth animation
    setTimeout(() => typingIndicator.classList.add('visible'), 10);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function hideTypingIndicator() {
    return new Promise((resolve) => {
      if (typingIndicator) {
        typingIndicator.classList.remove('visible');
        // Reduced timeout to 150ms for faster fade out
        setTimeout(() => {
          if (typingIndicator) {
            typingIndicator.remove();
            typingIndicator = null;
          }
          resolve();
        }, 150);
      } else {
        resolve();
      }
    });
  }

  async function appendMessage(role, content) {
    // Remove empty state if it exists
    if (emptyState) {
      emptyState.remove();
    }

    // Wait for typing indicator to fully disappear
    await hideTypingIndicator();

    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    messageDiv.classList.add(role === 'user' ? 'user-message' : 'assistant-message');
    messageDiv.textContent = content;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function insertFontCSS(css) {
    const styleElement = document.createElement('style');
    styleElement.appendChild(document.createTextNode(css));
    document.head.appendChild(styleElement);
    console.log("el", styleElement);
  }
  async function processMessage() {
    const userMessage = messageInput.value.trim();
    if (!userMessage && !currentImage) return;

    messageInput.value = '';
    sendButton.disabled = true;      // Disable send button

    // Remove empty state if it exists
    const currentEmptyState = document.querySelector('.empty-state');
    if (currentEmptyState) {
      currentEmptyState.remove();
    }

    // Create message content array
    const content = [];
    if (userMessage) {
      content.push({ type: "text", text: userMessage });
    }
    if (currentImage) {
      content.push({
        type: "image_url",
        image_url: {
          url: currentImage,
          detail: "auto"
        }
      });
    }

    // Append user message
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', 'user-message');
    if (userMessage) {
      const textSpan = document.createElement('span');
      textSpan.textContent = userMessage;
      messageDiv.appendChild(textSpan);
    }
    if (currentImage) {
      const img = document.createElement('img');
      img.src = currentImage;
      messageDiv.appendChild(img);
    }
    messagesContainer.appendChild(messageDiv);

    // Show typing indicator
    showTypingIndicator();
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
      const messages = [...getMessageHistory(), { role: 'user', content }];

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages })
      });

      // Clear current image after sending
      currentImage = null;
      const previewContainer = document.querySelector('.image-preview-container');
      if (previewContainer) {
        previewContainer.remove();
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Received AI response:', data);

      if (data.type === "text_response") {
        appendMessage('assistant', data.content);
      } else if (data.type === "ui_update") {
        await hideTypingIndicator(); // Hide before theme update
        if (data.css) {
          console.log("inserting", data.css);
          insertFontCSS(data.css);
        }
        updateTheme(data.ui_changes);
        appendMessage('assistant', data.content);
      } else if (data.type === "vision_response") {
        appendMessage('assistant', data.content);
      } else {
        appendMessage('assistant', 'Unexpected response format from AI');
      }
    } catch (error) {
      console.error('Error calling API:', error);
      appendMessage('assistant', `Sorry, there was an error: ${error.message}`);
    } finally {
      sendButton.disabled = false;     // Re-enable send button
      messageInput.focus();
    }
  }

  function getMessageHistory() {
    const messages = [];
    const messageElements = messagesContainer.querySelectorAll('.message');
    messageElements.forEach(el => {
      const role = el.classList.contains('user-message') ? 'user' : 'assistant';
      messages.push({ role, content: el.textContent });
    });
    return messages;
  }

  // Only call processMessage if sendButton is not disabled
  sendButton.addEventListener('click', (_) => {
    if (!sendButton.disabled) processMessage();
  });

  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!sendButton.disabled) {
        processMessage();
      }
    }
  });

  messageInput.addEventListener('input', () => {
    messageInput.value = messageInput.value.replace(/\n/g, ' ');
  });

  imageInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid image file (PNG, JPEG, WEBP, or GIF)');
      return;
    }

    // Validate file size (20MB limit)
    if (file.size > 20 * 1024 * 1024) {
      alert('Image size must be less than 20MB');
      return;
    }

    try {
      currentImage = await convertToBase64(file);
      // Show preview
      showImagePreview(currentImage, file.name);
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Error processing image');
    }
  });

  function convertToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function showImagePreview(base64Image, fileName) {
    // Remove any existing preview
    const existingPreview = document.querySelector('.image-preview-container');
    if (existingPreview) {
      existingPreview.remove();
    }

    // Create preview container
    const previewContainer = document.createElement('div');
    previewContainer.classList.add('image-preview-container');

    // Create preview item
    const previewItem = document.createElement('div');
    previewItem.classList.add('image-preview-item');

    // Create image element
    const img = document.createElement('img');
    img.src = base64Image;
    img.alt = fileName;

    // Create remove button
    const removeButton = document.createElement('button');
    removeButton.classList.add('remove-image');
    removeButton.innerHTML = '<i class="fas fa-times"></i>';
    removeButton.addEventListener('click', () => {
      currentImage = null;
      previewContainer.remove();
    });

    // Assemble preview
    previewItem.appendChild(img);
    previewItem.appendChild(removeButton);
    previewContainer.appendChild(previewItem);

    // Insert preview before textarea
    const textareaWrapper = document.querySelector('.textarea-wrapper');
    textareaWrapper.insertBefore(previewContainer, messageInput);
  }

  console.log('Chat application initialized!');
});

