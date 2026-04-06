import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaUser, FaClipboardList, FaPlus, FaTimes } from '../../lib/fa-icons';
import IconEdit from '../../components/Icon/IconEdit';
import IconTrashLines from '../../components/Icon/IconTrashLines';

// ── Types ──────────────────────────────────────────────────────────────────────

type VisitorStatus = 'checked-in' | 'checked-out' | 'scheduled';
type ContactRole = 'Next of Kin' | 'Guardian' | 'Emergency Contact' | 'Family' | 'Other';

interface Visitor {
  id: string;
  name: string;
  relationship: string;
  checkIn: string;
  checkOut?: string;
  status: VisitorStatus;
  restrictions?: string;
}

interface PatientContact {
  id: string;
  name: string;
  relationship: string;
  role: ContactRole;
  phone: string;
  email?: string;
  isNOK: boolean;
}

// ── Mock data (replace with API calls) ────────────────────────────────────────

const MOCK_VISITORS: Visitor[] = [
  { id: '1', name: 'Jane Doe', relationship: 'Spouse', checkIn: '2025-07-14T09:00', checkOut: '2025-07-14T11:30', status: 'checked-out' },
  { id: '2', name: 'Mark Doe', relationship: 'Son', checkIn: '2025-07-14T14:00', status: 'checked-in' },
];

const MOCK_CONTACTS: PatientContact[] = [
  { id: '1', name: 'Jane Doe', relationship: 'Spouse', role: 'Next of Kin', phone: '555-0101', email: 'jane@example.com', isNOK: true },
  { id: '2', name: 'Robert Doe', relationship: 'Father', role: 'Guardian', phone: '555-0102', isNOK: false },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const statusBadge: Record<VisitorStatus, string> = {
  'checked-in': 'bg-success/10 text-success',
  'checked-out': 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400',
  'scheduled': 'bg-primary/10 text-primary',
};

const statusLabel: Record<VisitorStatus, string> = {
  'checked-in': 'Checked In',
  'checked-out': 'Checked Out',
  'scheduled': 'Scheduled',
};

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

// ── Visitor Form Modal ────────────────────────────────────────────────────────

const EMPTY_VISITOR: Omit<Visitor, 'id'> = { name: '', relationship: '', checkIn: '', status: 'scheduled', restrictions: '' };

function VisitorModal({ initial, onSave, onClose }: {
  initial?: Visitor;
  onSave: (v: Omit<Visitor, 'id'>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Omit<Visitor, 'id'>>(initial ? { ...initial } : { ...EMPTY_VISITOR });
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const valid = form.name.trim() && form.relationship.trim() && form.checkIn;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-white dark:bg-[#0e1726] rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 bg-primary text-white rounded-t-lg">
          <h5 className="font-semibold">{initial ? 'Edit Visitor' : 'Add Visitor'}</h5>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/20"><FaTimes /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Visitor Name *</label>
            <input className="form-input w-full" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Full name" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Relationship *</label>
            <input className="form-input w-full" value={form.relationship} onChange={e => set('relationship', e.target.value)} placeholder="e.g. Spouse, Parent" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Check-in *</label>
              <input type="datetime-local" className="form-input w-full" value={form.checkIn} onChange={e => set('checkIn', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Check-out</label>
              <input type="datetime-local" className="form-input w-full" value={form.checkOut ?? ''} onChange={e => set('checkOut', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Status</label>
            <select className="form-select w-full" value={form.status} onChange={e => set('status', e.target.value as VisitorStatus)}>
              <option value="scheduled">Scheduled</option>
              <option value="checked-in">Checked In</option>
              <option value="checked-out">Checked Out</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Restrictions / Notes</label>
            <input className="form-input w-full" value={form.restrictions ?? ''} onChange={e => set('restrictions', e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-4 border-t border-white-light dark:border-[#191e3a]">
          <button className="btn btn-outline-primary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!valid} onClick={() => onSave(form)}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Contact Form Modal ────────────────────────────────────────────────────────

const EMPTY_CONTACT: Omit<PatientContact, 'id'> = { name: '', relationship: '', role: 'Family', phone: '', email: '', isNOK: false };

function ContactModal({ initial, onSave, onClose }: {
  initial?: PatientContact;
  onSave: (c: Omit<PatientContact, 'id'>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Omit<PatientContact, 'id'>>(initial ? { ...initial } : { ...EMPTY_CONTACT });
  const set = (k: keyof typeof form, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const valid = form.name.trim() && form.phone.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-white dark:bg-[#0e1726] rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 bg-primary text-white rounded-t-lg">
          <h5 className="font-semibold">{initial ? 'Edit Contact' : 'Add Contact'}</h5>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/20"><FaTimes /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Full Name *</label>
            <input className="form-input w-full" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Full name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Relationship</label>
              <input className="form-input w-full" value={form.relationship} onChange={e => set('relationship', e.target.value)} placeholder="e.g. Spouse" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Role</label>
              <select className="form-select w-full" value={form.role} onChange={e => set('role', e.target.value as ContactRole)}>
                {(['Next of Kin', 'Guardian', 'Emergency Contact', 'Family', 'Other'] as ContactRole[]).map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Phone *</label>
            <input className="form-input w-full" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="Phone number" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Email</label>
            <input type="email" className="form-input w-full" value={form.email ?? ''} onChange={e => set('email', e.target.value)} placeholder="Optional" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="form-checkbox" checked={form.isNOK} onChange={e => set('isNOK', e.target.checked)} />
            <span className="text-sm text-gray-700 dark:text-gray-300">Mark as Next of Kin (NOK)</span>
          </label>
        </div>
        <div className="flex justify-end gap-3 p-4 border-t border-white-light dark:border-[#191e3a]">
          <button className="btn btn-outline-primary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!valid} onClick={() => onSave(form)}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const VisitorsContacts: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'visitors' | 'contacts'>('visitors');

  // Visitors state
  const [visitors, setVisitors] = useState<Visitor[]>(MOCK_VISITORS);
  const [visitorModal, setVisitorModal] = useState<{ open: boolean; editing?: Visitor }>({ open: false });

  // Contacts state
  const [contacts, setContacts] = useState<PatientContact[]>(MOCK_CONTACTS);
  const [contactModal, setContactModal] = useState<{ open: boolean; editing?: PatientContact }>({ open: false });

  // ── Visitor handlers ──
  const saveVisitor = (data: Omit<Visitor, 'id'>) => {
    if (visitorModal.editing) {
      setVisitors(vs => vs.map(v => v.id === visitorModal.editing!.id ? { ...data, id: v.id } : v));
    } else {
      setVisitors(vs => [...vs, { ...data, id: Date.now().toString() }]);
    }
    setVisitorModal({ open: false });
  };

  const deleteVisitor = (id: string) => setVisitors(vs => vs.filter(v => v.id !== id));

  // ── Contact handlers ──
  const saveContact = (data: Omit<PatientContact, 'id'>) => {
    if (contactModal.editing) {
      setContacts(cs => cs.map(c => c.id === contactModal.editing!.id ? { ...data, id: c.id } : c));
    } else {
      setContacts(cs => [...cs, { ...data, id: Date.now().toString() }]);
    }
    setContactModal({ open: false });
  };

  const deleteContact = (id: string) => setContacts(cs => cs.filter(c => c.id !== id));

  const nok = contacts.find(c => c.isNOK);

  return (
    <div>
      <div className="panel h-[calc(100vh-120px)] overflow-y-auto">
        {/* Breadcrumb */}
        <div className="mb-5">
          <ul className="flex items-center gap-2 text-sm">
            <li><Link to="/app/patients/list" className="text-primary hover:underline">Patient List</Link></li>
            <li>/</li>
            <li className="text-gray-900 dark:text-white font-medium">Visitors & Contacts</li>
          </ul>
        </div>

        {/* NOK summary banner */}
        {nok && (
          <div className="mb-5 flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
            <span className="font-semibold text-primary">NOK:</span>
            <span className="text-gray-800 dark:text-gray-200">{nok.name}</span>
            <span className="text-gray-500">·</span>
            <span className="text-gray-600 dark:text-gray-400">{nok.relationship}</span>
            <span className="text-gray-500">·</span>
            <span className="text-gray-600 dark:text-gray-400">{nok.phone}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-5">
          <ul className="flex border-b border-white-light dark:border-[#191e3a]">
            <li>
              <button
                onClick={() => setActiveTab('visitors')}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 border-transparent hover:text-primary ${activeTab === 'visitors' ? '!border-primary text-primary' : ''}`}
              >
                <FaUser className="w-4 h-4" /> Visitor Log
              </button>
            </li>
            <li>
              <button
                onClick={() => setActiveTab('contacts')}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 border-transparent hover:text-primary ${activeTab === 'contacts' ? '!border-primary text-primary' : ''}`}
              >
                <FaClipboardList className="w-4 h-4" /> Family & Contacts
              </button>
            </li>
          </ul>
        </div>

        {/* ── Visitor Log Tab ── */}
        {activeTab === 'visitors' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Today's Visitor Log</h3>
              <button className="btn btn-primary btn-sm flex items-center gap-2" onClick={() => setVisitorModal({ open: true })}>
                <FaPlus className="w-3 h-3" /> Add Visitor
              </button>
            </div>

            {visitors.length === 0 ? (
              <p className="text-center py-8 text-gray-500 dark:text-gray-400">No visitors recorded.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white-light dark:border-[#191e3a]">
                      <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Name</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Relationship</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Check-in</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Check-out</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Status</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Restrictions</th>
                      <th className="py-2 px-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {visitors.map(v => (
                      <tr key={v.id} className="border-b border-white-light dark:border-[#191e3a] hover:bg-gray-50 dark:hover:bg-white/5">
                        <td className="py-2 px-3 font-medium text-gray-900 dark:text-white">{v.name}</td>
                        <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{v.relationship}</td>
                        <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{fmt(v.checkIn)}</td>
                        <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{v.checkOut ? fmt(v.checkOut) : '—'}</td>
                        <td className="py-2 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusBadge[v.status]}`}>
                            {statusLabel[v.status]}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-gray-500 dark:text-gray-400 text-xs">{v.restrictions || '—'}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <button className="btn btn-sm btn-outline-primary p-1.5" onClick={() => setVisitorModal({ open: true, editing: v })} title="Edit">
                              <IconEdit className="w-3 h-3" />
                            </button>
                            <button className="btn btn-sm btn-outline-danger p-1.5" onClick={() => deleteVisitor(v.id)} title="Delete">
                              <IconTrashLines className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Family & Contacts Tab ── */}
        {activeTab === 'contacts' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Family & Contacts</h3>
              <button className="btn btn-primary btn-sm flex items-center gap-2" onClick={() => setContactModal({ open: true })}>
                <FaPlus className="w-3 h-3" /> Add Contact
              </button>
            </div>

            {contacts.length === 0 ? (
              <p className="text-center py-8 text-gray-500 dark:text-gray-400">No contacts recorded.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white-light dark:border-[#191e3a]">
                      <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Name</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Relationship</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Role</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Phone</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">Email</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-400">NOK</th>
                      <th className="py-2 px-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map(c => (
                      <tr key={c.id} className="border-b border-white-light dark:border-[#191e3a] hover:bg-gray-50 dark:hover:bg-white/5">
                        <td className="py-2 px-3 font-medium text-gray-900 dark:text-white">{c.name}</td>
                        <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{c.relationship}</td>
                        <td className="py-2 px-3">
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">{c.role}</span>
                        </td>
                        <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{c.phone}</td>
                        <td className="py-2 px-3 text-gray-500 dark:text-gray-400 text-xs">{c.email || '—'}</td>
                        <td className="py-2 px-3">
                          {c.isNOK && (
                            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-success/10 text-success">NOK</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <button className="btn btn-sm btn-outline-primary p-1.5" onClick={() => setContactModal({ open: true, editing: c })} title="Edit">
                              <IconEdit className="w-3 h-3" />
                            </button>
                            <button className="btn btn-sm btn-outline-danger p-1.5" onClick={() => deleteContact(c.id)} title="Delete">
                              <IconTrashLines className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {visitorModal.open && (
        <VisitorModal
          initial={visitorModal.editing}
          onSave={saveVisitor}
          onClose={() => setVisitorModal({ open: false })}
        />
      )}
      {contactModal.open && (
        <ContactModal
          initial={contactModal.editing}
          onSave={saveContact}
          onClose={() => setContactModal({ open: false })}
        />
      )}
    </div>
  );
};

export default VisitorsContacts;
