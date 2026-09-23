import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
import { StudentProfile } from "./helper/profile-summary";

const CareerAdvisorState = Annotation.Root({
    ...MessagesAnnotation.spec,
    studentProfile: Annotation<StudentProfile>({
        reducer: (oldProfile: StudentProfile, newUpdates: Partial<StudentProfile>) => ({...oldProfile, ...newUpdates}),
        default: () => ({ interests: [], strengths: [], preferredIndustries: [] }),
    }),
});

export default CareerAdvisorState;