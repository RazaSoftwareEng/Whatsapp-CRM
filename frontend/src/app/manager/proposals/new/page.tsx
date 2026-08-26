"use client";

import { useEffect, useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { api } from "@/lib/api";
import { isValidUaePkPhone } from "@/lib/phone";
import { PhoneInput } from "@/components/ui/PhoneInput";
import type { CompanyRow } from "@/types/companies";

const DEFAULT_TITLE = "Client confirmation, approval and responsibility for fta tax filing";

const FTA_CONFIRMATION_TEMPLATE = `I/We, the undersigned Client, confirm that I/we have reviewed the complete tax filing prepared for submission to the UAE Federal Tax Authority ("FTA") and give full approval for its submission. By approving, I/we declare that:

• This confirmation applies to both VAT filing and Corporate Tax filing submitted to the FTA.
• All information and documents provided to Al Merak Tax Consultant L.L.C are complete, accurate, and not misleading.
• The filing was prepared solely on the information I/we furnished, confirmed, or approved, with no further changes required.
• As the Taxable Person, I/we retain full responsibility for the accuracy of the filing and compliance with UAE tax laws.
• I/we accept responsibility for any liabilities, penalties, or fines resulting from inaccurate or incomplete information provided by me/us.
• Al Merak Tax Consultant L.L.C prepared this filing in good faith based on our information and is not liable for independently verifying it; I/we agree to indemnify Al Merak Tax Consultant L.L.C against claims arising from information we supplied.

أقر أنا/نحن، العميل الموقّع أدناه، بأنني/أننا راجعت/راجعنا الإقرار الضريبي الكامل المُعد لتقديمه إلى الهيئة الاتحادية للضرائب في دولة الإمارات العربية المتحدة ("الهيئة")، وأمنح/نمنح موافقتي/موافقتنا الكاملة على تقديمه. وبموافقتي/موافقتنا، أقر/نقر بما يلي:

• ينطبق هذا الإقرار على كل من إقرار ضريبة القيمة المضافة وإقرار ضريبة الشركات المقدمين إلى الهيئة.
• جميع المعلومات والمستندات المقدمة إلى شركة المرك للاستشارات الضريبية ذ.م.م كاملة ودقيقة وغير مضللة.
• تم إعداد الإقرار بناءً فقط على المعلومات التي قدمتها/قدمناها أو أكدتها/أكدناها أو اعتمدتها/اعتمدناها، ولا توجد تعديلات إضافية مطلوبة.
• بصفتي/بصفتنا الشخص الخاضع للضريبة، أتحمل/نتحمل كامل المسؤولية عن دقة الإقرار والالتزام بالقوانين الضريبية الإماراتية.
• أتحمل/نتحمل مسؤولية أي التزامات أو غرامات أو جزاءات ناتجة عن معلومات غير دقيقة أو غير مكتملة قدمتها/قدمناها.
• أعدّت شركة المرك للاستشارات الضريبية ذ.م.م هذا الإقرار بحسن نية بناءً على معلوماتنا، وهي غير مسؤولة عن التحقق المستقل منها؛ وأوافق/نوافق على تعويض شركة المرك للاستشارات الضريبية ذ.م.م عن أي مطالبات ناشئة عن المعلومات التي قدمناها.`;

const TEMPLATES = [
  { label: "FTA Tax Filing Confirmation (default)", body: FTA_CONFIRMATION_TEMPLATE },
  {
    label: "Initial Outreach",
    body: "Hello,\n\nWe'd love to work with you. Please review the attached details and let us know your thoughts.\n\nLooking forward to your confirmation.",
  },
  {
    label: "Service Confirmation",
    body: "Hello,\n\nPlease review the service details below and confirm so we can proceed.\n\nThank you.",
  },
  {
    label: "Renewal / Follow-up",
    body: "Hello,\n\nThis is a follow-up regarding your upcoming renewal. Please review and confirm at your earliest convenience.\n\nThank you.",
  },
];

const emptyCompanyFields = { company_name: "", contact_person: "", email: "", phone: "" };

export default function NewProposalPage() {
  const router = useRouter();

  const [companyId, setCompanyId] = useState<number | null>(null);
  const [companyFields, setCompanyFields] = useState(emptyCompanyFields);
  const [searchResults, setSearchResults] = useState<CompanyRow[]>([]);

  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [templateIndex, setTemplateIndex] = useState<number | "">("");
  const [message, setMessage] = useState(FTA_CONFIRMATION_TEMPLATE);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  const showResults = Boolean(companyFields.company_name.trim()) && companyId === null;

  useEffect(() => {
    if (!showResults) return;
    const t = setTimeout(() => {
      api
        .get<CompanyRow[]>(`/companies/?search=${encodeURIComponent(companyFields.company_name)}`)
        .then((res) => setSearchResults(res.data));
    }, 300);
    return () => clearTimeout(t);
  }, [companyFields.company_name, showResults]);

  const visibleResults = showResults ? searchResults : [];

  function updateCompanyField(field: keyof typeof companyFields, value: string) {
    setCompanyFields((prev) => ({ ...prev, [field]: value }));
    if (field === "company_name") setCompanyId(null); // typing away from a picked match falls back to search/new
  }

  function pickCompany(company: CompanyRow) {
    setCompanyId(company.id);
    setCompanyFields({
      company_name: company.company_name,
      contact_person: company.contact_person,
      email: company.email,
      phone: company.phone,
    });
    setSearchResults([]);
  }

  function selectTemplate(indexStr: string) {
    if (indexStr === "") {
      setTemplateIndex("");
      return;
    }
    const index = Number(indexStr);
    setTemplateIndex(index);
    setMessage(TEMPLATES[index].body);
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setError("");
    setWarning("");
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { title, message, ...companyFields };
      if (companyId !== null) payload.company = companyId;
      const res = await api.post("/proposals/", payload);
      const warnings = [res.data.invite_warning, res.data.email_warning].filter(Boolean);
      if (warnings.length) {
        setWarning(`Proposal was created as a draft, but sending failed: ${warnings.join(" ")}`);
      } else {
        router.push(`/manager/proposals/${res.data.id}`);
      }
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
      setError(data ? JSON.stringify(data) : "Could not create the proposal — check the fields.");
    } finally {
      setSubmitting(false);
    }
  }

  const phoneValid = isValidUaePkPhone(companyFields.phone);
  const canSubmit =
    title.trim() && message.trim() && companyFields.company_name.trim() && companyFields.email.trim() && phoneValid;

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold" style={{ color: "var(--text)" }}>
        New Proposal
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-muted)" }}>
        Create a confirmation document and send it to a company for review.
      </p>

      <form
        onSubmit={handleSubmit}
        className="max-w-xl rounded-2xl border p-5"
        style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
      >
        {error && (
          <p className="mb-4 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
            {error}
          </p>
        )}
        {warning && (
          <p className="mb-4 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--orange-soft)", color: "var(--orange)" }}>
            {warning}
          </p>
        )}

        <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Title
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mb-4 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--orange)]"
          style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
          required
        />

        <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Company Name
        </label>
        <div className="relative mb-1">
          <input
            value={companyFields.company_name}
            onChange={(e) => updateCompanyField("company_name", e.target.value)}
            placeholder="Type to search existing companies, or enter a new name"
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--orange)]"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
            required
          />
        </div>

        {visibleResults.length > 0 && (
          <div
            className="mb-4 overflow-hidden rounded-lg border"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            {visibleResults.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => pickCompany(c)}
                className="block w-full px-3 py-2 text-left text-sm hover:opacity-80"
                style={{ color: "var(--text)", borderTop: "1px solid var(--border)" }}
              >
                {c.company_name} <span style={{ color: "var(--text-faint)" }}>· {c.email}</span>
              </button>
            ))}
          </div>
        )}
        {!visibleResults.length && <div className="mb-4" />}

        <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Contact Person Name
        </label>
        <input
          value={companyFields.contact_person}
          onChange={(e) => updateCompanyField("contact_person", e.target.value)}
          className="mb-4 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--orange)]"
          style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
        />

        <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Email
        </label>
        <input
          type="email"
          value={companyFields.email}
          onChange={(e) => updateCompanyField("email", e.target.value)}
          className="mb-4 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--orange)]"
          style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
          required
        />

        <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Phone
        </label>
        <PhoneInput
          value={companyFields.phone}
          onChange={(v) => updateCompanyField("phone", v)}
          focusColor="var(--orange)"
        />
        <p className="mb-4 mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
          An invite email will be sent to the address above so the company can set up their own login password.
        </p>

        <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Message Template
        </label>
        <select
          value={templateIndex}
          onChange={(e) => selectTemplate(e.target.value)}
          className="mb-4 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--orange)]"
          style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
        >
          <option value="">Start from a template (optional)</option>
          {TEMPLATES.map((t, i) => (
            <option key={t.label} value={i}>
              {t.label}
            </option>
          ))}
        </select>

        <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Message
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={8}
          dir="auto"
          className="mb-5 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--orange)]"
          style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
          required
        />

        <button
          type="submit"
          disabled={submitting || !canSubmit}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, var(--orange), var(--indigo))", boxShadow: "var(--shadow-sm)" }}
        >
          <Send size={15} />
          {submitting ? "Sending…" : "Create & Send Email"}
        </button>
      </form>
    </div>
  );
}
