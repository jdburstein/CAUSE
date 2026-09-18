export type ProfileClassification = 'empty' | 'thin' | 'sufficient';

export interface StudentProfile {
    interests: string[];
    strengths: string[];
    preferredIndustries: string[];
}

export interface ProfileSummary {
    classification: ProfileClassification;
    formattedProfile: string;
}

export function summarizeProfile(profile: StudentProfile): ProfileSummary {
    const totalItems = profile.interests.length + profile.strengths.length + profile.preferredIndustries.length;

    let classification: ProfileClassification;
    if (totalItems === 0) {
        classification = 'empty';
    } else if (totalItems > 0 && totalItems < 3) {
        classification = 'thin';
    } else {
        classification = 'sufficient';
    }

    const interestsSentence = profile.interests.length > 0 ? `The student has shared interests in ${profile.interests.join(', ')}.`
    : `The student hasn't shared any interests yet.`;

    const strengthsSentence = profile.strengths.length > 0 ? `The student has identified strengths in ${profile.strengths.join(', ')}.`
    : `The student hasn't shared any strengths yet.`;

    const industriesSentence = profile.preferredIndustries.length > 0 ? `The student's preferred industries include ${profile.preferredIndustries.join(', ')}.`
    : `The student hasn't shared any preferred industries yet.`;

    const formattedProfile = `${interestsSentence} ${strengthsSentence} ${industriesSentence}`

    return { classification, formattedProfile };
};