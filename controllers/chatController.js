const { validationResult } = require('express-validator');
const {main}= require("../config/Ai");
const Chat = require('../models/Chat');
const User = require('../models/User');


// Mock AI responses for elderly care
const mockAIResponses = [
  "I understand your concern about medication management. Here are some helpful strategies: 1) Use a daily pill organizer with compartments for each day of the week. 2) Set phone alarms for medication times. 3) Keep a medication list with dosages and timing. 4) Consider asking your pharmacist about blister packing services. Always consult with healthcare providers before making changes to medication routines.",
  
  "Thank you for sharing your mobility concerns. Here are some gentle exercises and safety tips: 1) Chair exercises can help maintain strength and flexibility. 2) Consider using assistive devices like grab bars in the bathroom. 3) Ensure good lighting throughout the home. 4) Regular physical therapy can help maintain mobility. 5) Always consult with a healthcare provider before starting new exercises.",
  
  "Emotional well-being is just as important as physical health. Here are some supportive suggestions: 1) Maintain social connections through phone calls or video chats. 2) Engage in hobbies or activities that bring joy. 3) Consider counseling or support groups. 4) Practice relaxation techniques like deep breathing. 5) Don't hesitate to reach out to family, friends, or healthcare providers when feeling overwhelmed.",
  
  "Daily care routines can be made easier with these tips: 1) Create a consistent daily schedule. 2) Prepare meals in advance when possible. 3) Use adaptive tools for dressing and grooming. 4) Keep important items within easy reach. 5) Consider meal delivery services if cooking becomes difficult. Remember, it's okay to ask for help from family or professional caregivers.",
  
  "For emergency preparedness, I recommend: 1) Keep emergency contacts easily accessible. 2) Have a medical alert system if living alone. 3) Keep important medications in a readily accessible location. 4) Ensure smoke detectors and carbon monoxide detectors are working. 5) Have a flashlight and extra batteries available. If this is an urgent medical situation, please call 911 immediately.",
  
  "Regarding health monitoring, here are some helpful approaches: 1) Keep a daily log of symptoms or concerns. 2) Monitor vital signs as recommended by your doctor. 3) Stay up-to-date with regular medical appointments. 4) Keep a list of all medications and supplements. 5) Don't hesitate to contact healthcare providers with questions or concerns. Early intervention is often the best approach."
];

// Create new chat
const createChat = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { title, issue, category, priority } = req.body;
    const userId = req.user._id;

    const chat = new Chat({
      userId,
      title,
      issue,
      category,
      priority: priority || 'medium',
      messages: []
    });

    await chat.save();

    res.status(201).json({
      success: true,
      message: 'Chat created successfully',
      data: { chat }
    });
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating chat'
    });
  }
};

// Get user chats
const getUserChats = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20, status } = req.query;

    const query = { userId };
    if (status) query.status = status;

    const chats = await Chat.find(query)
      .sort({ 'metadata.lastActivity': -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-messages'); // Don't include messages in list view

    const total = await Chat.countDocuments(query);

    res.json({
      success: true,
      data: {
        chats,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get user chats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching chats'
    });
  }
};

// Get specific chat
const getChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findOne({ _id: chatId, userId });
    
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    res.json({
      success: true,
      data: { chat }
    });
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching chat'
    });
  }
};

// Send message and get AI response
const sendMessage = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { chatId } = req.params;
    const { content } = req.body;
    const userId = req.user._id;

    const chat = await Chat.findOne({ _id: chatId, userId });
    
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Add user message
    const userMessage = {
      role: 'user',
      content,
      timestamp: new Date()
    };
    
    chat.messages.push(userMessage);

    // Build clean history for AI: [{ role, content }]
    const history = (chat.messages || []).map(m => ({
      role: m.role,
      content: m.content
    }));

    // Get AI response with fallback to mock
    let response;
    try {
      response = await main(history);
      if (!response || typeof response !== 'string') {
        throw new Error('Empty AI response');
      }
    } catch (aiError) {
      console.error('AI provider error, using fallback:', aiError.message || aiError);
      const randomIndex = Math.floor(Math.random() * mockAIResponses.length);
      response = mockAIResponses[randomIndex];
    }
    // const aiwmessage=await Chat.create({
    //   content:response,
    //   userid:userid,
    //   role:"assistant",
    //   _id:chatId,
    // })
    // return res.status(201).json(
  
    // aiwmessage
    // );
    // // Get a random mock AI response
    // const randomIndex = Math.floor(Math.random() * mockAIResponses.length);
    // let aiResponse = mockAIResponses[randomIndex];
    
    // // Add some context-specific information based on chat category
    // const categoryContext = {
    //   health: "Remember to always consult with healthcare professionals for medical concerns.",
    //   medication: "Please verify any medication changes with your doctor or pharmacist.",
    //   mobility: "Consider consulting with a physical therapist for personalized advice.",
    //   emotional: "Don't hesitate to reach out to mental health professionals if needed.",
    //   daily_care: "Every small step towards better care makes a difference.",
    //   emergency: "If this is a medical emergency, please call 911 immediately.",
    //   other: "I'm here to help with any elderly care questions you might have."
    // };
    
    // // Add category-specific context to response
    // aiResponse += ` ${categoryContext[chat.category] || categoryContext.other}`;
    
    // // Simulate AI thinking time (500ms to 2 seconds)
    // const thinkingTime = Math.random() * 1500 + 500;
    // await new Promise(resolve => setTimeout(resolve, thinkingTime));

    // // Add AI response
    const assistantMessage = {
      role: 'assistant',
      content: response,
      timestamp: new Date()
    };
    
    chat.messages.push(assistantMessage);
    await chat.save();

    res.json({
      success: true,
      data: {
        userMessage,
        assistantMessage
      }
    });
      } catch (error) {
    console.error('Send message error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Server error sending message'
    });
  }
};

// Update chat (title, status, etc.)
const updateChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { title, status, priority } = req.body;
    const userId = req.user._id;

    const chat = await Chat.findOne({ _id: chatId, userId });
    
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    if (title) chat.title = title;
    if (status) chat.status = status;
    if (priority) chat.priority = priority;

    await chat.save();

    res.json({
      success: true,
      message: 'Chat updated successfully',
      data: { chat }
    });
  } catch (error) {
    console.error('Update chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating chat'
    });
  }
};

// Add review/rating to chat
const addReview = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { chatId } = req.params;
    const { rating, feedback } = req.body;
    const userId = req.user._id;

    const chat = await Chat.findOne({ _id: chatId, userId });
    
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    chat.review = {
      rating,
      feedback,
      reviewedAt: new Date()
    };

    // Mark chat as resolved if it was active
    if (chat.status === 'active') {
      chat.status = 'resolved';
    }

    await chat.save();

    res.json({
      success: true,
      message: 'Review added successfully',
      data: { chat }
    });
  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error adding review'
    });
  }
};

// Delete chat
const deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findOneAndDelete({ _id: chatId, userId });
    
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    res.json({
      success: true,
      message: 'Chat deleted successfully'
    });
  } catch (error) {
    console.error('Delete chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting chat'
    });
  }
};

module.exports = {
  createChat,
  getUserChats,
  getChat,
  sendMessage,
  updateChat,
  addReview,
  deleteChat
};
