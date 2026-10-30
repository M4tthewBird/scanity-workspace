export type Priority = 'P1' | 'P2' | 'P3';

export interface Member {
  user_id: string;
  name: string;
  color: string | null;
}

export interface Page {
  id: string;
  title: string;
  icon: string | null;
  description: string | null;
  position: number;
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
  text: string;
  done: boolean;
  priority: Priority | null;
  assignee: string | null;
  due: string | null;
  notes: string | null;
  position: number;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type TableName = 'pages' | 'sections' | 'tasks';

export interface WorkspaceData {
  members: Member[];
  pages: Page[];
  sections: Section[];
  tasks: Task[];
}
