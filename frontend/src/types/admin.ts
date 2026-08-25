export type Role = "admin" | "tl" | "agent" | "manager" | "company_user";

export type UserRow = {
  id: number;
  username: string;
  email: string;
  role: Role;
  status: string;
  phone_number: string;
  team_lead: number | null;
  team_lead_username: string | null;
};

export type ClientStatus = "first_time" | "follow_up" | "existing_client";

export type ChatRow = {
  id: number;
  lead: {
    id: number;
    name: string;
    company_name: string;
    email: string;
    phone_number: string;
    client_status: ClientStatus;
  };
  assigned_user: number | null;
  assigned_user_username: string | null;
  status: string;
  last_message_at: string | null;
  has_unread: boolean;
};

export type Message = {
  id: number;
  chat: number;
  direction: "in" | "out";
  body: string;
  delivery_status: string;
  sent_at: string;
};

export type ChatDetail = ChatRow & { messages: Message[] };

export type Violation = {
  id: number;
  user: number;
  username: string;
  action: "copy" | "right_click";
  path: string;
  created_at: string;
};
