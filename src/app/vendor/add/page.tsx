'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AddFoodPage() {
  const router = useRouter();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  
  // Basic Info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Rice');
  
  // Pricing
  const [priceType, setPriceType] = useState<'plate' | 'scoop'>('plate');
  const [singlePrice, setSinglePrice] = useState('');
  const [scoops, setScoops] = useState([{ id: 1, label: '1 Scoop', price: '' }]);
  
  // Extras
  const [compulsoryGroups, setCompulsoryGroups] = useState<{id: number, name: string, options: {id: number, name: string, price: string}[]}[]>([]);
  const [optionalExtras, setOptionalExtras] = useState<{id: number, name: string, price: string}[]>([]);
  
  // Settings
  const [isPreorder, setIsPreorder] = useState(false);
  const [preorderNote, setPreorderNote] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const url = URL.createObjectURL(e.target.files[0]);
      setPhotoUrl(url);
    }
  };

  const addScoop = () => setScoops([...scoops, { id: Date.now(), label: '', price: '' }]);
  const removeScoop = (id: number) => setScoops(scoops.filter(s => s.id !== id));
  
  const updateScoop = (id: number, field: 'label' | 'price', value: string) => {
    setScoops(scoops.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const addCompulsoryGroup = () => setCompulsoryGroups([...compulsoryGroups, { id: Date.now(), name: '', options: [{ id: Date.now() + 1, name: '', price: '' }] }]);
  const removeCompulsoryGroup = (id: number) => setCompulsoryGroups(compulsoryGroups.filter(g => g.id !== id));
  
  const addCompulsoryOption = (groupId: number) => {
    setCompulsoryGroups(groups => groups.map(g => 
      g.id === groupId 
        ? { ...g, options: [...g.options, { id: Date.now(), name: '', price: '' }] }
        : g
    ));
  };
  
  const removeCompulsoryOption = (groupId: number, optionId: number) => {
    setCompulsoryGroups(groups => groups.map(g => 
      g.id === groupId 
        ? { ...g, options: g.options.filter(o => o.id !== optionId) }
        : g
    ));
  };
  
  const updateCompulsoryGroup = (groupId: number, name: string) => {
    setCompulsoryGroups(groups => groups.map(g => g.id === groupId ? { ...g, name } : g));
  };

  const updateCompulsoryOption = (groupId: number, optionId: number, field: 'name' | 'price', value: string) => {
    setCompulsoryGroups(groups => groups.map(g => 
      g.id === groupId 
        ? { ...g, options: g.options.map(o => o.id === optionId ? { ...o, [field]: value } : o) }
        : g
    ));
  };

  const addOptionalExtra = () => setOptionalExtras([...optionalExtras, { id: Date.now(), name: '', price: '' }]);
  const removeOptionalExtra = (id: number) => setOptionalExtras(optionalExtras.filter(e => e.id !== id));
  const updateOptionalExtra = (id: number, field: 'name' | 'price', value: string) => {
    setOptionalExtras(extras => extras.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name, description, category, priceType,
      price: priceType === 'plate' ? singlePrice : scoops,
      compulsoryGroups, optionalExtras,
      isPreorder, preorderNote, isAvailable,
      photoUrl
    };
    console.log('Saving food item:', payload);
    alert('Food item saved successfully!');
    router.push('/vendor');
  };

  const Switch = ({ checked, onChange }: { checked: boolean, onChange: (v: boolean) => void }) => (
    <button 
      type="button" 
      onClick={() => onChange(!checked)}
      className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-[#00B978]' : 'bg-gray-200'}`}
    >
      <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${checked ? 'translate-x-6' : 'translate-x-0'}`}></div>
    </button>
  );

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 py-6 md:py-10 pb-32">
      {/* Top Bar */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/vendor" className="text-[#6E6D66] hover:text-[#111111]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </Link>
        <h1 className="font-display font-bold text-2xl text-[#111111]">Add Food Item</h1>
      </div>

      <div className="space-y-6">
        {/* Section 1: Photo */}
        <section className="bg-white rounded-2xl border border-gray-200/60 p-5 shadow-sm">
          <h2 className="font-display font-bold text-lg text-[#111111] mb-4">Photo</h2>
          {photoUrl ? (
            <div className="relative w-full h-48 md:h-64 rounded-xl overflow-hidden border border-gray-200">
              <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
              <button 
                type="button"
                onClick={() => setPhotoUrl(null)}
                className="absolute top-2 right-2 bg-white/90 text-red-600 p-2 rounded-full shadow hover:bg-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 hover:border-[#0C513F]/50 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6 text-gray-500">
                <svg className="w-10 h-10 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <p className="mb-2 text-sm font-semibold">Click to upload or drag & drop</p>
                <p className="text-xs">SVG, PNG, JPG or GIF</p>
              </div>
              <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
            </label>
          )}
        </section>

        {/* Section 2: Basic Info */}
        <section className="bg-white rounded-2xl border border-gray-200/60 p-5 shadow-sm">
          <h2 className="font-display font-bold text-lg text-[#111111] mb-4">Basic Info</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#111111]/80 mb-1.5">Food Name *</label>
              <input 
                type="text" required
                value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Jollof Rice"
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#0C513F]/20 focus:border-[#0C513F] outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#111111]/80 mb-1.5">Description (Optional)</label>
              <textarea 
                value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Describe your food..."
                rows={3}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#0C513F]/20 focus:border-[#0C513F] outline-none transition-all resize-none"
              ></textarea>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#111111]/80 mb-1.5">Category *</label>
              <select 
                value={category} onChange={e => setCategory(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#0C513F]/20 focus:border-[#0C513F] outline-none transition-all appearance-none"
              >
                {['Rice', 'Soups', 'Drinks', 'Swallow', 'Snacks', 'Sides', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* Section 3: Pricing */}
        <section className="bg-white rounded-2xl border border-gray-200/60 p-5 shadow-sm">
          <h2 className="font-display font-bold text-lg text-[#111111] mb-4">Pricing</h2>
          
          <div className="flex p-1 bg-gray-100 rounded-xl mb-6">
            <button 
              type="button" 
              onClick={() => setPriceType('plate')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${priceType === 'plate' ? 'bg-white shadow-sm text-[#111111]' : 'text-[#6E6D66]'}`}
            >
              Price per Plate 🍽️
            </button>
            <button 
              type="button" 
              onClick={() => setPriceType('scoop')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${priceType === 'scoop' ? 'bg-white shadow-sm text-[#111111]' : 'text-[#6E6D66]'}`}
            >
              Price per Scoop 🥄
            </button>
          </div>

          {priceType === 'plate' ? (
            <div>
              <label className="block text-sm font-semibold text-[#111111]/80 mb-1.5">Price *</label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-[#6E6D66] font-medium">₦</span>
                <input 
                  type="number" required min="0"
                  value={singlePrice} onChange={e => setSinglePrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-3 focus:ring-2 focus:ring-[#0C513F]/20 focus:border-[#0C513F] outline-none transition-all"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {scoops.map((scoop, index) => (
                <div key={scoop.id} className="flex items-center gap-3">
                  <div className="flex-1">
                    <input 
                      type="text" required placeholder="e.g. 1 Scoop"
                      value={scoop.label} onChange={e => updateScoop(scoop.id, 'label', e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#0C513F]/20 focus:border-[#0C513F] outline-none"
                    />
                  </div>
                  <div className="flex-1 relative">
                    <span className="absolute left-4 top-3 text-[#6E6D66] font-medium">₦</span>
                    <input 
                      type="number" required min="0" placeholder="0.00"
                      value={scoop.price} onChange={e => updateScoop(scoop.id, 'price', e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-3 focus:ring-2 focus:ring-[#0C513F]/20 focus:border-[#0C513F] outline-none"
                    />
                  </div>
                  {index > 0 && (
                    <button type="button" onClick={() => removeScoop(scoop.id)} className="text-red-500 p-2 hover:bg-red-50 rounded-lg">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addScoop} className="text-[#00B978] font-semibold text-sm flex items-center gap-1 mt-2 hover:text-[#0C513F]">
                + Add scoop size
              </button>
            </div>
          )}
        </section>

        {/* Section 4: Compulsory Extras */}
        <section className="bg-white rounded-2xl border border-gray-200/60 p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="font-display font-bold text-lg text-[#111111]">Required Add-ons</h2>
            <p className="text-sm text-[#6E6D66]">Customers MUST choose from these groups</p>
          </div>

          <div className="space-y-6">
            {compulsoryGroups.map((group) => (
              <div key={group.id} className="p-4 border border-gray-200 rounded-xl bg-gray-50/50">
                <div className="flex items-center gap-3 mb-4">
                  <input 
                    type="text" placeholder="Group Name (e.g. Choose Protein)" required
                    value={group.name} onChange={e => updateCompulsoryGroup(group.id, e.target.value)}
                    className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-[#0C513F]/20 focus:border-[#0C513F] outline-none font-medium"
                  />
                  <button type="button" onClick={() => removeCompulsoryGroup(group.id)} className="text-red-500 p-2 hover:bg-red-50 rounded-lg">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
                
                <div className="space-y-3 pl-4 border-l-2 border-gray-200 ml-2">
                  {group.options.map((option, idx) => (
                    <div key={option.id} className="flex items-center gap-3">
                      <input 
                        type="text" placeholder="Option name" required
                        value={option.name} onChange={e => updateCompulsoryOption(group.id, option.id, 'name', e.target.value)}
                        className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0C513F]/20 focus:border-[#0C513F] outline-none"
                      />
                      <div className="w-1/3 relative">
                        <span className="absolute left-3 top-2 text-[#6E6D66] font-medium text-sm">₦</span>
                        <input 
                          type="number" min="0" placeholder="0" required
                          value={option.price} onChange={e => updateCompulsoryOption(group.id, option.id, 'price', e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:ring-2 focus:ring-[#0C513F]/20 focus:border-[#0C513F] outline-none"
                        />
                      </div>
                      {idx > 0 && (
                        <button type="button" onClick={() => removeCompulsoryOption(group.id, option.id)} className="text-gray-400 hover:text-red-500 p-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => addCompulsoryOption(group.id)} className="text-[#00B978] font-semibold text-sm flex items-center gap-1 hover:text-[#0C513F]">
                    + Add option
                  </button>
                </div>
              </div>
            ))}
            <button type="button" onClick={addCompulsoryGroup} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-[#0C513F] font-semibold hover:border-[#0C513F]/50 hover:bg-[#FAF6EB] transition-colors flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              Add Required Group
            </button>
          </div>
        </section>

        {/* Section 5: Optional Extras */}
        <section className="bg-white rounded-2xl border border-gray-200/60 p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="font-display font-bold text-lg text-[#111111]">Optional Add-ons</h2>
            <p className="text-sm text-[#6E6D66]">Customers can optionally add these</p>
          </div>

          <div className="space-y-3">
            {optionalExtras.map((extra) => (
              <div key={extra.id} className="flex items-center gap-3">
                <input 
                  type="text" placeholder="Extra name (e.g. Extra Plantain)" required
                  value={extra.name} onChange={e => updateOptionalExtra(extra.id, 'name', e.target.value)}
                  className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#0C513F]/20 focus:border-[#0C513F] outline-none"
                />
                <div className="w-1/3 relative">
                  <span className="absolute left-4 top-3 text-[#6E6D66] font-medium">₦</span>
                  <input 
                    type="number" min="0" placeholder="0" required
                    value={extra.price} onChange={e => updateOptionalExtra(extra.id, 'price', e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-3 focus:ring-2 focus:ring-[#0C513F]/20 focus:border-[#0C513F] outline-none"
                  />
                </div>
                <button type="button" onClick={() => removeOptionalExtra(extra.id)} className="text-red-500 p-2 hover:bg-red-50 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            ))}
            <button type="button" onClick={addOptionalExtra} className="text-[#00B978] font-semibold text-sm flex items-center gap-1 hover:text-[#0C513F]">
              + Add extra
            </button>
          </div>
        </section>

        {/* Section 6: Preorder */}
        <section className="bg-white rounded-2xl border border-gray-200/60 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-display font-bold text-lg text-[#111111]">Available for Pre-order</h2>
            <Switch checked={isPreorder} onChange={setIsPreorder} />
          </div>
          <p className="text-sm text-[#6E6D66] mb-4">Pre-order items can be ordered in advance before they are ready</p>
          
          {isPreorder && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <label className="block text-sm font-semibold text-[#111111]/80 mb-1.5">Pre-order note</label>
              <input 
                type="text" 
                value={preorderNote} onChange={e => setPreorderNote(e.target.value)}
                placeholder="e.g. Available from 6pm daily"
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#0C513F]/20 focus:border-[#0C513F] outline-none transition-all"
              />
            </div>
          )}
        </section>

        {/* Section 7: Availability */}
        <section className="bg-white rounded-2xl border border-gray-200/60 p-5 shadow-sm flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-lg text-[#111111]">Currently Available</h2>
            <p className="text-sm text-[#6E6D66]">Turn off to temporarily hide from menu</p>
          </div>
          <Switch checked={isAvailable} onChange={setIsAvailable} />
        </section>
      </div>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-50 md:static md:bg-transparent md:border-0 md:p-0 md:mt-8 md:flex md:justify-end">
        <button 
          type="submit"
          className="w-full md:w-auto bg-[#0C513F] text-white font-bold text-lg px-8 py-3.5 rounded-full hover:bg-[#083a2d] transition-colors shadow-lg shadow-[#0C513F]/20"
        >
          Save Food Item
        </button>
      </div>
    </form>
  );
}
