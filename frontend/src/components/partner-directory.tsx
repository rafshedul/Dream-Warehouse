"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { apiFetch, ApiError } from "../lib/api";

type Contact = { id: number; name: string; phone: string; address: string };
type Partner = {
  id: number;
  contact_id: number;
  company_name: string;
  address: string;
  created_at: string;
};

const settings = {
  suppliers: {
    title: "Suppliers",
    singular: "Supplier",
    api: "/suppliers/",
    permissions: "Suppliers can be viewed and created by Admin or Manager accounts.",
  },
  customers: {
    title: "Customers",
    singular: "Customer",
    api: "/customers/",
    permissions: "Customers can be viewed by Admin, Manager, or Staff accounts.",
  },
} as const;

function errorText(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return error instanceof ApiError ? `${message} (HTTP ${error.status})` : message;
}

export default function PartnerDirectory({ kind }: { kind: keyof typeof settings }) {
  const config = settings[kind];
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPartner, setSavingPartner] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [partnerError, setPartnerError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactAddress, setContactAddress] = useState("");
  const [contactId, setContactId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [contactMode, setContactMode] = useState<"new" | "existing">("new");

  const contactMap = useMemo(() => new Map(contacts.map((contact) => [contact.id, contact])), [contacts]);
  const filteredPartners = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return partners;
    return partners.filter((partner) => {
      const contact = contactMap.get(partner.contact_id);
      return `${partner.company_name} ${partner.address} ${contact?.name ?? ""} ${contact?.phone ?? ""}`.toLowerCase().includes(query);
    });
  }, [contactMap, partners, search]);

  const fetchPartners = useCallback(() => apiFetch<Partner[]>(config.api), [config.api]);

  useEffect(() => {
    let active = true;
    Promise.allSettled([apiFetch<Contact[]>("/contacts/"), fetchPartners()]).then((results) => {
      if (!active) return;
      const messages: string[] = [];
      if (results[0].status === "fulfilled") setContacts(results[0].value);
      else messages.push(`Contacts: ${errorText(results[0].reason)}`);
      if (results[1].status === "fulfilled") setPartners(results[1].value);
      else messages.push(`${config.singular} list: ${errorText(results[1].reason)}`);
      setLoadError(messages.join(" · "));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [config.singular, fetchPartners, refreshKey]);

  async function createPartner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPartnerError("");
    setSuccess("");
    setSavingPartner(true);
    try {
      const createNewContact = contactMode === "new";
      const created = await apiFetch<Partner>(config.api, {
        method: "POST",
        body: JSON.stringify(createNewContact ? {
          company_name: companyName.trim(),
          address: companyAddress.trim(),
          contact_name: contactName.trim(),
          contact_phone: contactPhone.trim(),
          contact_address: contactAddress.trim(),
        } : {
          contact_id: Number(contactId),
          company_name: companyName.trim(),
          address: companyAddress.trim(),
        }),
      });
      setPartners((current) => [...current, created].sort((a, b) => a.id - b.id));
      if (createNewContact) {
        setContacts((current) => [...current, {
          id: created.contact_id,
          name: contactName.trim(),
          phone: contactPhone.trim(),
          address: contactAddress.trim(),
        }]);
        setContactId(String(created.contact_id));
        setContactMode("existing");
        setContactName("");
        setContactPhone("");
        setContactAddress("");
      }
      setCompanyName("");
      setCompanyAddress("");
      setSuccess(`${config.singular} “${created.company_name}” created.`);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        setPartnerError("Your login session is missing or expired. Open /login in another tab, sign in with an Admin, Manager, or Staff account, then return here and submit again. Your entered details will stay in this form.");
      } else if (cause instanceof ApiError && cause.status === 403) {
        setPartnerError("Your account does not have permission to create this record. Sign in with an allowed role.");
      } else {
        setPartnerError(errorText(cause));
      }
    } finally {
      setSavingPartner(false);
    }
  }

  function refresh() {
    setLoading(true);
    setLoadError("");
    setRefreshKey((key) => key + 1);
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] p-5 text-slate-800 md:p-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white px-6 py-5 shadow-sm">
          <div><h1 className="mt-2 text-2xl font-bold">{config.title}</h1><p className="mt-1 text-sm text-slate-500">Manage company records and their contact details.</p></div>
          <button type="button" onClick={refresh} disabled={loading} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">{loading ? "Loading…" : "↻ Refresh"}</button>
        </header>

        {loadError && <section role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">Some directory data could not be loaded.</p><p className="mt-1">{loadError}</p><p className="mt-2">{config.permissions}</p></section>}
        {partnerError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Could not create {config.singular.toLowerCase()}: {partnerError}</p>}
        {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>}

        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><div><h2 className="font-bold">{config.title} directory</h2><p className="mt-1 text-sm text-slate-500">{loading ? "Loading…" : `${partners.length} ${config.title.toLowerCase()}`}</p></div>
            <label className="sr-only" htmlFor={`${kind}-search`}>Search {config.title.toLowerCase()}</label><input id={`${kind}-search`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${config.title.toLowerCase()}…`} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 sm:w-64" />
          </div>
          {loading ? <p role="status" className="p-10 text-center text-sm text-slate-500">Loading {config.title.toLowerCase()} from the API…</p> : filteredPartners.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">{partners.length ? `No ${config.title.toLowerCase()} match your search.` : `No ${config.title.toLowerCase()} found yet.`}</p> :
            <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">ID</th><th className="px-5 py-3">Company</th><th className="px-5 py-3">Contact person</th><th className="px-5 py-3">Phone</th><th className="px-5 py-3">Address</th><th className="px-5 py-3">Created</th></tr></thead>
              <tbody>{filteredPartners.map((partner) => { const contact = contactMap.get(partner.contact_id); return <tr key={partner.id} className="border-t border-slate-100"><td className="px-5 py-4 text-slate-500">{partner.id}</td><td className="px-5 py-4 font-semibold">{partner.company_name}</td><td className="px-5 py-4">{contact?.name ?? `Contact #${partner.contact_id}`}</td><td className="px-5 py-4">{contact?.phone ?? "—"}</td><td className="max-w-xs px-5 py-4 text-slate-600">{partner.address}</td><td className="px-5 py-4 text-slate-500">{new Date(partner.created_at).toLocaleDateString()}</td></tr>; })}</tbody>
            </table></div>}
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="font-bold">Add {config.singular.toLowerCase()}</h2><p className="mt-1 text-sm text-slate-500">Enter the company and contact person, then create them together.</p>
          <form onSubmit={createPartner} className="mt-5 grid gap-4 sm:grid-cols-2">
            <div><label htmlFor={`${kind}-company-name`} className="mb-1.5 block text-sm font-medium">Company name *</label><input id={`${kind}-company-name`} required maxLength={150} value={companyName} onChange={(event) => setCompanyName(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" placeholder={`${config.singular} company`} /></div>
            <div><label htmlFor={`${kind}-company-address`} className="mb-1.5 block text-sm font-medium">Company address *</label><input id={`${kind}-company-address`} required maxLength={255} value={companyAddress} onChange={(event) => setCompanyAddress(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" placeholder="Company address" /></div>
            <fieldset className="space-y-3 sm:col-span-2"><legend className="mb-2 text-sm font-semibold">Contact person *</legend>
              <div className="flex flex-wrap gap-2"><button type="button" aria-pressed={contactMode === "new"} onClick={() => setContactMode("new")} className={`rounded-lg border px-3 py-2 text-sm ${contactMode === "new" ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-200"}`}>Enter new contact</button><button type="button" aria-pressed={contactMode === "existing"} disabled={contacts.length === 0} onClick={() => setContactMode("existing")} className={`rounded-lg border px-3 py-2 text-sm disabled:opacity-50 ${contactMode === "existing" ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-200"}`}>Use existing contact</button></div>
              {contactMode === "existing" ? <div><label htmlFor={`${kind}-contact-select`} className="mb-1.5 block text-sm font-medium">Select contact *</label><select id={`${kind}-contact-select`} required value={contactId} onChange={(event) => setContactId(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"><option value="" disabled>Select a contact</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name} · {contact.phone}</option>)}</select><p className="mt-1 text-xs text-slate-500">Existing user account contacts also appear here.</p></div> : <div className="grid gap-4 sm:grid-cols-3"><div><label htmlFor={`${kind}-contact-name`} className="mb-1.5 block text-sm font-medium">Contact name *</label><input id={`${kind}-contact-name`} required maxLength={150} value={contactName} onChange={(event) => setContactName(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" placeholder="Contact person's name" /></div><div><label htmlFor={`${kind}-contact-phone`} className="mb-1.5 block text-sm font-medium">Phone *</label><input id={`${kind}-contact-phone`} required maxLength={50} value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" placeholder="Phone number" /></div><div><label htmlFor={`${kind}-contact-address`} className="mb-1.5 block text-sm font-medium">Contact address *</label><input id={`${kind}-contact-address`} required maxLength={255} value={contactAddress} onChange={(event) => setContactAddress(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" placeholder="Contact person's address" /></div></div>}
            </fieldset>
            <div className="sm:col-span-2"><button type="submit" disabled={savingPartner || (contactMode === "existing" && !contactId)} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{savingPartner ? `Creating ${config.singular.toLowerCase()}…` : `Create ${config.singular.toLowerCase()}`}</button><p className="mt-2 text-xs text-slate-500">{config.permissions} New contact and {config.singular.toLowerCase()} are saved together.</p></div>
          </form>
        </section>
      </div>
    </main>
  );
}
