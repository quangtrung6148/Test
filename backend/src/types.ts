export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface NewTask {
  title: string;
  description: string;
}

export interface TaskStore {
  list(userId: string): Promise<Task[]>;
  pending(): Promise<Task[]>;
  create(input: NewTask, userId: string): Promise<Task>;
  complete(id: string, userId: string): Promise<Task>;
}

export interface AccountUser { id: string; email: string; }
export interface AccountSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}
export interface AuthResult {
  user: AccountUser | null;
  session: AccountSession | null;
  confirmation_required: boolean;
}
export interface AuthService {
  register(email: string, password: string): Promise<AuthResult>;
  login(email: string, password: string): Promise<AuthResult>;
  refresh(refreshToken: string): Promise<AuthResult>;
  user(accessToken: string): Promise<AccountUser>;
  logout(accessToken: string): Promise<void>;
}
