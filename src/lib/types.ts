export type Priority = 'P1' | 'P2' | 'P3';
export type PageKind = 'product' | 'industry' | 'job' | 'template';
export type JobStage = 'poptavka' | 'nabidka' | 'realizace' | 'predano' | 'vyfakturovano';
export type IdeaStatus = 'new' | 'considering' | 'approved' | 'rejected' | 'done';
export type CommentTarget = 'task' | 'job' | 'idea' | 'company' | 'contact' | 'milestone';

export interface Member {
  user_id: string;
  name: string;
  color: string | null;
}

export interface Page {
  id: string;
  kind: PageKind;
  title: string;
  icon: string | null;
  description: string | null;
  position: number;
  stage: JobStage | null;
  price: number | null;
  start_date: string | null;
  due_date: string | null;
  industry_id: string | null;
  company_id: string | null;
  contact_id: string | null;
  tags: string[];
  created_at: string | null;
  updated_at: string | null;
}

export interface Section {
  id: string;
  page_id: string;
  title: string;
  position: number;
}

export interface Task {
  id: string;
  page_id: string;
  section_id: string | null;
  milestone_id: string | null;
  text: string;
  done: boolean;
  priority: Priority | null;
  assignee: string | null;
  due: string | null;
  notes: string | null;
  tags: string[];
  position: number;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Company {
  id: string;
  name: string;
  industry_id: string | null;
  website: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Contact {
  id: string;
  name: string;
  company_id: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Idea {
  id: string;
  text: string;
  notes: string | null;
  status: IdeaStatus;
  product_id: string | null;
  tags: string[];
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Milestone {
  id: string;
  title: string;
  product_id: string | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  position: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface Comment {
  id: string;
  target_type: CommentTarget;
  target_id: string;
  body: string;
  system: boolean;
  author: string | null;
  created_at: string | null;
}

export interface TableRows {
  pages: Page;
  sections: Section;
  tasks: Task;
  companies: Company;
  contacts: Contact;
  ideas: Idea;
  milestones: Milestone;
  comments: Comment;
}

export type TableName = keyof TableRows;

export const TABLES: TableName[] = ['pages', 'sections', 'tasks', 'companies', 'contacts', 'ideas', 'milestones', 'comments'];

export type WorkspaceData = { members: Member[] } & { [T in TableName]: TableRows[T][] };

export const JOB_STAGES: { id: JobStage; label: string }[] = [
  { id: 'poptavka', label: 'Poptávka' },
  { id: 'nabidka', label: 'Nabídka' },
  { id: 'realizace', label: 'Realizace' },
  { id: 'predano', label: 'Předáno' },
  { id: 'vyfakturovano', label: 'Vyfakturováno' },
];

export const IDEA_STATUSES: { id: IdeaStatus; label: string }[] = [
  { id: 'new', label: 'Nový' },
  { id: 'considering', label: 'Zvažujeme' },
  { id: 'approved', label: 'Schváleno' },
  { id: 'rejected', label: 'Zamítnuto' },
  { id: 'done', label: 'Hotovo' },
];
