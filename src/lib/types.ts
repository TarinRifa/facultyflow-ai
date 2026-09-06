export type Priority = "low" | "medium" | "high" | "urgent";
export type Status = "pending" | "in_progress" | "completed";
export type Task = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  due_at: string | null;
  priority: Priority;
  category: string;
  course_code: string;
  status: Status;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  priority_rank: number;
};
export type Profile = {
  id: string;
  display_name: string;
  timezone: string;
  created_at: string;
  updated_at: string;
};
export type Database = {
  public: {
    Tables: {
      tasks: {
        Row: Task;
        Insert: Omit<
          Task,
          "id" | "created_at" | "updated_at" | "completed_at" | "priority_rank"
        > & { id?: string };
        Update: Partial<Omit<Task, "id" | "user_id" | "priority_rank">>;
        Relationships: [];
      };
      profiles: {
        Row: Profile;
        Insert: { id: string; display_name?: string; timezone?: string };
        Update: { display_name?: string; timezone?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
export interface Dashboard {
  pending: number;
  completed: number;
  upcoming: number;
  overdue: number;
  total: number;
  urgent: Task[];
  now: string;
  timezone: string;
}
