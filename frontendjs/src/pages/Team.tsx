import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building2,
  Plus,
  Search,
  Globe,
  Trash2,
  Loader2,
  Check,
  X,
  Palette,
  Image as ImageIcon,
  Facebook,
  Instagram,
  Linkedin,
  Pin,
  Link as LinkIcon
} from 'lucide-react';
import { useClient } from '../context/ClientContext';
import { cn } from '@/lib/utils';

export function Team() {
  const { clients, refreshClients, activeClient, setActiveClient } = useClient();
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    theme: 'indigo',
    logo: ''
  });

  const handleConnect = (platform: string, clientId: string) => {
    // Redirect to backend auth routes with client_id
    window.location.href = `http://localhost:5001/api/auth/${platform}?client_id=${clientId}`;
  };

  const platformsList = [
    { id: 'facebook', icon: Facebook, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'instagram', icon: Instagram, color: 'text-pink-600', bg: 'bg-pink-50' },
    { id: 'linkedin', icon: Linkedin, color: 'text-blue-700', bg: 'bg-blue-50' },
    { id: 'pinterest', icon: Pin, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5001/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await refreshClients();
        setIsAdding(false);
        setFormData({ name: '', theme: 'indigo', logo: '' });
      }
    } catch (error) {
      console.error('Failed to add client:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClient = async (id: string, name: string) => {
    if (name === 'BNB' || name === 'BNB Social Hub') {
      alert("This is your primary agency and cannot be deleted.");
      return;
    }

    if (!confirm(`Are you sure you want to delete "${name}"? All associated posts and data will be removed.`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5001/api/clients/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await refreshClients();
      } else {
        const err = await response.json();
        alert(`Failed to delete: ${err.error}`);
      }
    } catch (error) {
      console.error('Failed to delete client:', error);
    }
  };

  const themes = [
    { id: 'indigo', color: 'bg-indigo-600' },
    { id: 'blue', color: 'bg-blue-500' },
    { id: 'emerald', color: 'bg-emerald-500' },
    { id: 'orange', color: 'bg-orange-500' },
    { id: 'rose', color: 'bg-rose-500' }
  ];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Client Agencies</h1>
          <p className="text-slate-500 text-sm mt-1 font-medium flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-500" />
            Manage your agency portfolio and client workspaces.
          </p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-slate-200"
        >
          <Plus className="w-4 h-4" />
          Add New Agency
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="col-span-1 bg-white p-6 rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center min-h-[300px]"
            >
              <form onSubmit={handleAddClient} className="w-full space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Agency Name</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                    placeholder="Enter agency name..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Theme Color</label>
                  <div className="flex gap-2">
                    {themes.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, theme: t.id })}
                        className={cn(
                          "w-8 h-8 rounded-full border-4 transition-all",
                          t.color,
                          formData.theme === t.id ? "border-slate-900" : "border-white shadow-sm"
                        )}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Logo URL (Optional)</label>
                  <div className="relative">
                    <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={formData.logo}
                      onChange={e => setFormData({ ...formData, logo: e.target.value })}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-slate-900 text-white py-3 rounded-2xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Create Agency
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="w-12 h-12 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center hover:bg-slate-200 transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {clients.map((client) => (
          <motion.div
            layout
            key={client.id}
            className={cn(
              "bg-white p-8 rounded-[2.5rem] border shadow-sm transition-all group relative overflow-hidden",
              activeClient?.id === client.id ? "border-indigo-500 ring-4 ring-indigo-50" : "border-slate-100 hover:border-indigo-200"
            )}
          >
            <div className="flex items-start justify-between relative z-10">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-white font-black text-2xl overflow-hidden shadow-lg",
                  client.logo ? "bg-white" : (
                    client.theme === 'indigo' ? 'bg-indigo-600' :
                    client.theme === 'blue' ? 'bg-blue-500' :
                    client.theme === 'emerald' ? 'bg-emerald-500' :
                    client.theme === 'rose' ? 'bg-rose-500' : 'bg-orange-500'
                  )
                )}>
                  {client.logo ? <img src={client.logo} className="w-full h-full object-cover" /> : client.name[0]}
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">{client.name}</h3>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Agency Workspace</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 items-end">
                <button
                  onClick={() => setActiveClient(client)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                    activeClient?.id === client.id
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100"
                      : "bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white"
                  )}
                >
                  {activeClient?.id === client.id ? 'Active' : 'Select'}
                </button>
                {activeClient?.id !== client.id && (
                  <button
                    onClick={() => handleDeleteClient(client.id, client.name)}
                    className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                    title="Delete Agency"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4 relative z-10">
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Connect Socials</p>
                <div className="flex gap-2 mt-2">
                  {platformsList.map(plt => (
                    <button
                      key={plt.id}
                      onClick={() => handleConnect(plt.id, client.id)}
                      className={cn(
                        "p-2 rounded-lg transition-all hover:scale-110 shadow-sm",
                        plt.bg, plt.color
                      )}
                      title={`Connect ${plt.id}`}
                    >
                      <plt.icon className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Workspace</p>
                <p className="text-lg font-black text-slate-900 mt-1">Ready</p>
              </div>
            </div>

            <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition-opacity">
               <div className="w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
