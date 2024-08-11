// frontend\src\components\TitleGenerator.js

import React, { useEffect, useState } from 'react';

const TitleGenerator = ({ messages, onTitleGenerated }) => {
  const [error, setError] = useState(null);

  const generateTitle = async () => {
    try {
      console.log('Generating title for messages:', messages);
      const response = await fetch('http://localhost:5000/api/generate_title', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': '', // Include this even if it's empty
        },
        body: JSON.stringify({
          prompt: "Summarize the conversation in 5 words or fewer:\nBe as concise as possible without losing the context of the conversation.\nYour goal is to extract the key point of the conversation.",
          messages
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to generate title: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Generated title:', data.title);
      onTitleGenerated(data.title);
      setError(null);
    } catch (error) {
      console.error('Error generating title:', error);
      setError('Failed to generate title. Using default.');
      onTitleGenerated(generateFallbackTitle(messages));
    }
  };

  const generateFallbackTitle = (messages) => {
    if (messages.length === 0) return 'New Conversation';
    const firstMessage = messages[0].text;
    return firstMessage.length > 30 ? `${firstMessage.substring(0, 30)}...` : firstMessage;
  };

  useEffect(() => {
    if (messages.length > 0 && messages[0].text) {
      generateTitle();
    }
  }, [messages]);

  return error ? <div className="error-message">{error}</div> : null;
};

export default TitleGenerator;
