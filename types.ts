
export interface CodeItem {
  id: string;
  value: string;
  isUsed: boolean;
  isReserved?: boolean; 
  dateAdded: number;
  claimedAt?: number; 
  claimedByIgn?: string; 
  source?: 'raffle_win' | 'direct_scan';
  isBadCode?: boolean;
}

export type ViewState = 'DASHBOARD' | 'DISTRIBUTE';

export type UserRole = 'super_admin' | 'admin' | 'user';

export interface UserProfile {
    uid: string;
    email: string;
    role: UserRole;
    lastLogin: number;
    profile?: AmbassadorSettings;
}

export interface AmbassadorSettings {
  communityName: string;
  campfireUrl: string;
  groupLogo: string | null;
  notes: string;
  limitWarning?: string;
  description?: string;
  socialUrl?: string;
}

export interface AppSettings {
  baseUrl: string;
  vibration: boolean;
  testMode: boolean;
  distributionCap: number;
  blockIncognito: boolean;
  removeDailyLimit: boolean;
  ambassador: AmbassadorSettings;
}

export interface SessionData {
  id: string;
  createdAt: number;
  active: boolean;
  paused: boolean;
  totalCodes: number;
  claimedCodes: number;
  distributionCap: number;
  claimedCount: number;
  removeDailyLimit: boolean;
  ambassador: AmbassadorSettings;
  isTestSession?: boolean;
  blockIncognito?: boolean;
  reportCount?: number;
  replacementCount?: number;
  hostDevice?: string; 
  ghostSessionId?: string;
  raffleLink?: string; 
  linkedRaffleId?: string; // ID of the raffle session linked to this distribution
  isGhostSession?: boolean;
  isIssueMode?: boolean;
}

export interface ReportItem {
  id: string;
  sessionId: string;
  deviceId: string;
  badCode: string;
  newCode?: string;
  status: 'pending' | 'resolved' | 'cancelled';
  timestamp: number;
  ign?: string;
}

export interface RaffleWinner {
  participantId: string;
  participantName: string;
  awardedAt: number;
}

export interface RafflePrize {
  id: string;
  name: string;
  isGrandPrize: boolean;
  quantity?: number;
  remaining?: number;
  winners?: RaffleWinner[];
  winnerId?: string;
  winnerName?: string;
  awardedAt?: number;
  isDigitalCode?: boolean;
  distributorSessionId?: string;
  isSpecial?: boolean; // Requires manual host release
  specificCodeValue?: string; // The secret code value entered by host
  allowOptOut?: boolean;
}

export interface RaffleSession {
  id: string;
  hostDevice: string;
  hostUid?: string;
  active: boolean;
  createdAt: number;
  status: 'WAITING' | 'ROLLING' | 'WINNER_DECLARED';
  prizes: RafflePrize[];
  currentPrizeId?: string;
  currentPrize?: string;
  blockedDeviceIds?: string[];
  winnerId: string | null;
  winnerName: string | null;
  ghostSessionId?: string;
  linkedDistributorId?: string; // ID of the distribution session linked to this raffle
}

export interface RaffleParticipant {
  id: string;
  deviceId: string;
  name: string;
  ign: string;
  joinedAt: number;
  isWinner: boolean;
  wonPrize?: string;
  isManual?: boolean;
  isSpecialWin?: boolean;
  isReleased?: boolean;
  releasedCode?: string;
  optedOutPrizeIds?: string[];
}

export interface Waypoint {
  id: string;
  name: string;
  clue: string;
  latitude: number;
  longitude: number;
  radius: number;
  secretCode?: string;
  order: number;
}

export interface ScavengerParticipant {
    id: string;
    deviceId: string;
    name: string;
    ign: string;
    joinedAt: number;
    completedCount: number;
    lastCheckpointTime?: number;
}

export interface ScavengerHunt {
  id: string;
  title: string;
  description: string;
  active: boolean;
  createdAt: number;
  gameMode?: 'sequential' | 'free_roam';
  waypoints: Waypoint[];
  ambassador?: AmbassadorSettings;
}

export interface TriviaQuestion {
    id: string;
    text: string;
    options: string[];
    correctIndex: number;
    timeLimit: number;
}

export interface PlayerAnswer {
    questionIndex: number;
    selectedOption: number;
    isCorrect: boolean;
    timeTaken: number;
}

export interface TriviaPlayer {
    id: string;
    deviceId: string;
    name: string;
    score: number;
    streak: number;
    lastAnswerIndex: number | null;
    lastAnswerTime: number | null;
    isCorrect: boolean | null;
    currentQuestionIndex?: number; 
    status?: 'PLAYING' | 'FINISHED';
    correctAnswersCount?: number;
    answerHistory?: PlayerAnswer[];
}

export interface TriviaShareConfig {
    enabled: boolean;
    backgroundImage?: string;
}

export interface TriviaSession {
    id: string;
    hostDevice: string;
    hostUid?: string;
    active: boolean;
    createdAt: number;
    title?: string;
    mode?: 'LIVE' | 'SELF_PACED';
    expiresAt?: number;
    status: 'LOBBY' | 'QUESTION' | 'REVEAL' | 'LEADERBOARD' | 'FINISHED';
    currentQuestionIndex: number;
    questions: TriviaQuestion[];
    startTime?: number;
    winnerName?: string;
    winnerScore?: number;
    ambassador?: AmbassadorSettings;
    shareConfig?: TriviaShareConfig;
}
