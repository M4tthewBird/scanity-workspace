import type { Task } from '../../lib/types';

export interface ViewProps {
  pageId: string;
  sectionId: string | null;
  tasks: Task[];
  newTaskAssignee: string | null;
  onOpenTask: (id: string) => void;
}
