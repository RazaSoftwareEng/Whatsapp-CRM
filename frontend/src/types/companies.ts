export type CompanyStatus = "active" | "inactive";

export type CompanyRow = {
  id: number;
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  status?: CompanyStatus;
};

export type ProposalStatus = "draft" | "pending_review" | "approved" | "rejected" | "changes_requested";

export type ProposalRow = {
  id: number;
  title: string;
  message: string;
  company: CompanyRow;
  status: ProposalStatus;
  status_display: string;
  created_by_username: string | null;
  last_email_error: string;
  review_token: string;
  created_at: string;
  updated_at: string;
  email_warning?: string;
  invite_warning?: string;
  invite_link?: string;
  whatsapp_link?: string | null;
};

export type ProposalActivity = {
  id: number;
  proposal: number;
  proposal_title: string;
  actor_username: string | null;
  action: "created" | "sent" | "resent" | "approved" | "rejected" | "changes_requested";
  action_display: string;
  note: string;
  ip_address: string | null;
  location: string;
  created_at: string;
};

export type DashboardStats = {
  total: number;
  pending_review: number;
  approved: number;
  rejected: number;
  changes_requested: number;
};
