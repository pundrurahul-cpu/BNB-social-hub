import React, { useState, useRef } from 'react';
import { Camera, Mail, Phone, MapPin, Briefcase, Check } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { cn } from '@/lib/utils';

export function Profile() {
  const { profile, updateProfile } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: profile?.name || '',
    role: profile?.role || 'user',
    email: profile?.email || '',
    phone: profile?.phone || '',
    location: profile?.location || '',
    company: profile?.company || '',
    avatar: profile?.avatar || ''
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    updateProfile(formData);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const fileUrl = URL.createObjectURL(e.target.files[0]);
      updateProfile({ avatar: fileUrl });
      setFormData(prev => ({ ...prev, avatar: fileUrl }));
    }
  };

  return (
    <div className="space-y-6 max-w-4xl h-full pb-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Profile</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your personal information and preferences.</p>
      </div>
      
      <div className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden card-shadow">
        <div className="h-32 bg-gradient-to-r from-slate-200 to-slate-100 relative"></div>
        <div className="px-6 pb-6 relative">
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="-mt-12 relative w-24 h-24 rounded-full border-4 border-white bg-white shadow-sm shrink-0 group">
              <img src={profile?.avatar || `https://api.dicebear.com/7.x/notionists/svg?seed=${profile?.name}&backgroundColor=f1f5f9`} alt={profile?.name} className="w-full h-full rounded-full object-cover" />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-slate-900/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Camera className="w-6 h-6 text-white" />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleFileChange}
              />
            </div>
            <div className="pt-2 sm:pt-4 flex-1">
              <h2 className="text-xl font-bold text-slate-900">{profile?.name}</h2>
              <p className="text-slate-500 text-sm font-medium">{profile?.role}</p>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Contact Info</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-slate-600 text-sm">
                  <Mail className="w-4 h-4 text-slate-400" />
                  {profile?.email}
                </div>
                <div className="flex items-center gap-3 text-slate-600 text-sm">
                  <Phone className="w-4 h-4 text-slate-400" />
                  {profile?.phone}
                </div>
                <div className="flex items-center gap-3 text-slate-600 text-sm">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  {profile?.location}
                </div>
                <div className="flex items-center gap-3 text-slate-600 text-sm">
                  <Briefcase className="w-4 h-4 text-slate-400" />
                  {profile?.company}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Profile Settings</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                     <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                     <input 
                       type="text" 
                       value={formData.name} 
                       onChange={(e) => setFormData({...formData, name: e.target.value})}
                       className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-100 focus:border-slate-400 transition-all" 
                     />
                  </div>
                  <div className="col-span-2">
                     <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                     <input 
                       type="text" 
                       value={formData.role} 
                       onChange={(e) => setFormData({...formData, role: e.target.value})}
                       className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-100 focus:border-slate-400 transition-all" 
                     />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                     <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                     <input 
                       type="email" 
                       value={formData.email} 
                       onChange={(e) => setFormData({...formData, email: e.target.value})}
                       className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-100 focus:border-slate-400 transition-all" 
                     />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                     <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                     <input 
                       type="text" 
                       value={formData.phone} 
                       onChange={(e) => setFormData({...formData, phone: e.target.value})}
                       className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-100 focus:border-slate-400 transition-all" 
                     />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                     <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                     <input 
                       type="text" 
                       value={formData.location} 
                       onChange={(e) => setFormData({...formData, location: e.target.value})}
                       className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-100 focus:border-slate-400 transition-all" 
                     />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                     <label className="block text-sm font-medium text-slate-700 mb-1">Company</label>
                     <input 
                       type="text" 
                       value={formData.company} 
                       onChange={(e) => setFormData({...formData, company: e.target.value})}
                       className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-100 focus:border-slate-400 transition-all" 
                     />
                  </div>
                </div>
                <button 
                  onClick={handleSave}
                  className="bg-slate-900 flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm"
                >
                  {saved ? <Check className="w-4 h-4" /> : null}
                  {saved ? 'Saved' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
