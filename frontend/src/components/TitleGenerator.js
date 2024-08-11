import React, { useEffect, useState } from 'react';

const TitleGenerator = ({ messages, onTitleGenerated }) => {
  const [error, setError] = useState(null);

  const generateTitle = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/generate_title', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate title');
      }

      const data = await response.json();
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
    if (messages.length > 0) {
      generateTitle();
    }
  }, [messages]);

  return error ? <div className="error-message">{error}</div> : null;
};

export default TitleGenerator;
