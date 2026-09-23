import { ChatOllama } from "@langchain/ollama";
import CareerAdvisorState from "./state";
import { SystemMessage } from "@langchain/core/messages";
import { summarizeProfile, ProfileSummary } from "./helper/profile-summary";
import { StateGraph, START, END } from "@langchain/langgraph";

const llm = new ChatOllama({
    model: "llama3.2",
    baseUrl: "http://localhost:11434",
    temperature: 0.6
});

/* Uncomment once Claude credentiakls are acquired for the project
const llm = new ChatAnthropic({
    model: "claude-",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    temperature: 0.6
}); 
*/

const profileExtractionNode = async (state: typeof CareerAdvisorState.State) => {
    const recentMessages = state.messages.slice(-2);

    const systemPrompt = new SystemMessage(
        "You are a background analysis worker. Analyze the user's latest message. " +
        "Extract any stated interests, skills, or favorite subjects as a JSON object with keys: " +
        "'interests', 'strengths', and 'preferredIndustries'. Do not talk to the user. Only output raw valid JSON."
    );

    try {
        const response = await llm.invoke([systemPrompt, ...recentMessages]);
        const parsedUpdates = JSON.parse(response.content.toString());
        return { studentProfile: parsedUpdates };
    } catch (e) {
        return {};
    }
}

const counselorNode = async (state: typeof CareerAdvisorState.State) => {
   const profileSummary: ProfileSummary = summarizeProfile(state.studentProfile);
   const { classification, formattedProfile } = profileSummary;

   try {
    if (classification === 'empty') {
        const systemPrompt = new SystemMessage(
            "You are a career counselor. The student has not provided any information about their interests, strengths, or preferred industries. " +
            "Please ask the student to provide this information in order to give better career advice."
        )
        const response = await llm.invoke([systemPrompt]);
        return { messages: [{ role: "assistant", content: response.content.toString() }] };

    } else if (classification === 'thin') {
        const systemPrompt = new SystemMessage(
            "You are a career counselor. The student has provided some information, but it is limited. " + formattedProfile + " " +
            "Please ask the student to provide more details about their interests, strengths, and preferred industries to give better career advice."
        )
        const response = await llm.invoke([
            systemPrompt, ...state.messages
        ])
        return { messages: [{ role: "assistant", content: response.content.toString() }] };

    } else {
        const systemPrompt = new SystemMessage(
            "You are a career counselor. The student has provided sufficient information about their interests, strengths, and preferred industries. " +
            "Please provide career advice based on the following profile summary: " + formattedProfile
        )
        const response = await llm.invoke([
            systemPrompt, ...state.messages
        ])
        return { messages: [{ role: "assistant", content: response.content.toString() }] };
    }
   } catch (e) {
        return { messages: [{ role: "assistant", content: "Sorry I ran into an issure processing this. Please try again!" }] };
   }
}

const graph = new StateGraph(CareerAdvisorState)
    .addNode("extract", profileExtractionNode)
    .addNode("counsel", counselorNode)
    .addEdge(START, "extract")
    .addEdge("extract", "counsel")
    .addEdge("counsel", END);

export const app = graph.compile();
