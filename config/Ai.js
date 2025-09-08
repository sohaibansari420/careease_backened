const Groq = require("groq-sdk");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });
  
  async function main(history) {
    const chatCompletion = await getGroqChatCompletion(history);
    return chatCompletion.choices[0]?.message?.content || "";
  }
  
  async function getGroqChatCompletion(history) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is not configured");
    }
    return groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a compassionate elder-care assistant focused on health and wellness. Keep answers concise, ask clarifying questions when needed, and avoid topics unrelated to health and care. Always remind users to consult professionals for medical decisions.",
        },
        ...history
      ],
      model: "llama-3.3-70b-versatile",
    });
  }

  async function nameforchat(usermsg, aimsg, conlist) {
    const formattedContent = `
  User Message: ${usermsg}
  AI Message: ${aimsg}
  Previous Titles: ${conlist.map(c => c.convoname).join(", ")}
  `;
  
    return groq.chat.completions.create({
      messages: [
        {
          role: "assistant",
          content:
            "you are a title maker agent. I will give you a part of conversation which will have a response from an AI and a question from a user. You will produce a short 3-word title. I will also give you a list of previous conversation title names which you will keep in mind and produce a different title than them.",
        },
        {
          role: "user",
          content: formattedContent, // ✅ Now it's a string
        }
      ],
      model: "llama-3.3-70b-versatile",
    });
  }
  

  async function name(usermsg,aimsg,conlist) {
    const t=await nameforchat(usermsg,aimsg,conlist)
    return t.choices[0]?.message?.content || "";
  }
  
  module.exports={main,name}