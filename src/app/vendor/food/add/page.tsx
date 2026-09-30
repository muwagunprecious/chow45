'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AddFoodPage() {
  const router = useRouter();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  
  // Vendor Info
  const [vendorsList, setVendorsList] = useState<Array<{ id: number; businessName: string }>>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null);

  // Basic Info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('rice');
  
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

  // Form State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [draftSavedText, setDraftSavedText] = useState('');

  // Restore draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('chow45_vendor_add_food_page_draft');
      if (raw) {
        const d = JSON.parse(raw);
        if (d.name) setName(d.name);
        if (d.description) setDescription(d.description);
        if (d.category) setCategory(d.category);
        if (d.priceType) setPriceType(d.priceType);
        if (d.singlePrice) setSinglePrice(d.singlePrice);
        if (Array.isArray(d.scoops) && d.scoops.length) setScoops(d.scoops);
        if (Array.isArray(d.compulsoryGroups)) setCompulsoryGroups(d.compulsoryGroups);
        if (Array.isArray(d.optionalExtras)) setOptionalExtras(d.optionalExtras);
        if (d.photoUrl) setPhotoUrl(d.photoUrl);
        if (typeof d.isPreorder === 'boolean') setIsPreorder(d.isPreorder);
        if (d.preorderNote) setPreorderNote(d.preorderNote);
        if (typeof d.isAvailable === 'boolean') setIsAvailable(d.isAvailable);
        setDraftSavedText('✓ Progress restored from your auto-saved draft');
      }
    } catch {}
  }, []);

  // Auto-save draft on changes
  useEffect(() => {
    if (!name && !description && !singlePrice && !photoUrl) return;
    const timer = setTimeout(() => {
      try {
        const payload = {
          name,
          description,
          category,
          priceType,
          singlePrice,
          scoops,
          compulsoryGroups,
          optionalExtras,
          photoUrl,
          isPreorder,
          preorderNote,
          isAvailable,
          savedAt: Date.now()
        };
        localStorage.setItem('chow45_vendor_add_food_page_draft', JSON.stringify(payload));
        // Also sync with marketplace vendor draft so both flows share draft
        localStorage.setItem('chow45_vendor_food_draft', JSON.stringify({
          dishId: null,
          name,
          category,
          image: photoUrl,
          desc: description,
          priceType: priceType.toUpperCase(),
          platePrice: singlePrice,
          scoopPrice: scoops[0]?.price || '',
          piecePrice: singlePrice,
          lastSaved: Date.now()
        }));
        setDraftSavedText('✓ All progress auto-saved to draft');
      } catch {}
    }, 400);
    return () => clearTimeout(timer);
  }, [name, description, category, priceType, singlePrice, scoops, compulsoryGroups, optionalExtras, photoUrl, isPreorder, preorderNote, isAvailable]);

  // Fetch real vendors on load
  useEffect(() => {
    fetch('/api/admin/foods')
      .then((res) => res.json())
      .then((data) => {
        if (data.vendors && data.vendors.length > 0) {
          setVendorsList(data.vendors);
          setSelectedVendorId(data.vendors[0].id);
        }
      })
      .catch((err) => console.warn('Could not load vendors list:', err));
  }, []);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');

    try {
      const isPiece = ['drinks', 'snacks', 'grills', 'shawarma', 'others'].includes(category.toLowerCase());
      const pType = isPiece ? 'PIECE' : priceType.toUpperCase();
      const numPlatePrice = Number(singlePrice) || 0;
      const numScoopPrice = Number(scoops[0]?.price) || 0;

      const flatCompulsoryExtras = compulsoryGroups.flatMap((group) =>
        group.options
          .filter((opt) => opt.name.trim())
          .map((opt) => ({
            name: `${group.name ? `${group.name}: ` : ''}${opt.name.trim()}`,
            price: Number(opt.price) || 0,
          }))
      );

      const flatOptionalExtras = optionalExtras
        .filter((opt) => opt.name.trim())
        .map((opt) => ({
          name: opt.name.trim(),
          price: Number(opt.price) || 0,
        }));

      const res = await fetch('/api/vendor/menu-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          category: category.toLowerCase(),
          priceType: pType,
          platePrice: isPiece ? null : numPlatePrice,
          scoopPrice: isPiece ? null : (numScoopPrice || null),
          piecePrice: isPiece ? numPlatePrice : null,
          imageUrl: photoUrl || null,
          vendorId: selectedVendorId,
          status: isAvailable ? 'available' : 'out_of_stock',
          preorderEnabled: isPreorder,
          preorderDate: isPreorder ? preorderNote : null,
          compulsoryExtras: flatCompulsoryExtras,
          optionalExtras: flatOptionalExtras,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save food item');
      }

      alert('Food item submitted successfully! It is now live on your Chow45 vendor menu.');
      localStorage.removeItem('chow45_vendor_add_food_page_draft');
      localStorage.removeItem('chow45_vendor_food_draft');
      router.push('/vendor');
    } catch (err: any) {
      setSubmitError(err.message || 'Error saving food item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const Switch = ({ checked, onChange }: { checked: boolean, onChange: (v: boolean) => void }) => (
    <button 
      type="button" 
      onClick={() => onChange(!checked)}
      className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-[#0C513F]' : 'bg-gray-200'}`}
    >
      <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${checked ? 'translate-x-6' : 'translate-x-0'}`}></div>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#FFFDF6] text-[#111111] pb-24">
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 py-8">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link href="/vendor" className="p-2 text-[#6E6D66] hover:text-[#0C513F] bg-white rounded-full border border-gray-200 shadow-sm transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </Link>
            <div>
              <h1 className="font-display font-extrabold text-2xl text-[#111111]">Upload Vendor Food</h1>
              <p className="text-xs text-[#6E6D66]">Submits dishes directly to your Chow45 vendor menu</p>
            </div>
          </div>
          <Link href="/vendor" className="text-xs font-semibold text-[#0C513F] hover:underline">
            Vendor Dashboard →
          </Link>
        </div>

        {/* Auto-saved draft indicator */}
        {draftSavedText && (
          <div className="mb-6 px-4 py-3 rounded-2xl bg-[#E8F6F0] border border-[#0C513F]/20 flex items-center justify-between gap-3 text-xs text-[#0C513F] font-semibold">
            <div className="flex items-center gap-2">
              <span>🟢</span>
              <span>{draftSavedText}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('chow45_vendor_add_food_page_draft');
                localStorage.removeItem('chow45_vendor_food_draft');
                setName('');
                setDescription('');
                setSinglePrice('');
                setPhotoUrl(null);
                setDraftSavedText('Draft cleared');
              }}
              className="text-xs text-red-600 hover:underline cursor-pointer"
            >
              Clear Draft
            </button>
          </div>
        )}

        {/* Verification notice */}
        <div className="mb-6 p-4 rounded-2xl bg-[#FFF9E6] border border-[#FFC928]/40 flex items-start gap-3">
          <span className="text-xl leading-none">⏳</span>
          <div>
            <h4 className="text-xs font-extrabold text-[#7A5B00]">Pending Admin Verification</h4>
            <p className="text-xs text-[#8A6700] mt-0.5 leading-relaxed">
              Dishes uploaded by vendors are held in a pending verification queue and will not be visible to customers in the marketplace until approved by the admin.
            </p>
          </div>
        </div>

        {submitError && (
          <div className="p-4 mb-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
            {submitError}
          </div>
        )}

        <div className="space-y-6">
          {/* Section: Select Vendor Store */}
          <section className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
            <h2 className="font-display font-bold text-lg text-[#111111] mb-2">Vendor Store</h2>
            <p className="text-xs text-[#6E6D66] mb-3">Assign this food item to the registered store.</p>
            <select
              value={selectedVendorId || ''}
              onChange={(e) => setSelectedVendorId(Number(e.target.value))}
              className="w-full bg-[#FAF6EB] border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#0C513F]/20 focus:border-[#0C513F] outline-none font-semibold text-sm"
              required
            >
              {vendorsList.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.businessName || `Vendor #${v.id}`}
                </option>
              ))}
            </select>
          </section>

          {/* Section 1: Photo */}
          <section className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
            <h2 className="font-display font-bold text-lg text-[#111111] mb-1">Food Photo</h2>
            <p className="text-xs text-[#6E6D66] mb-4">Upload from your device gallery or photo files.</p>
            {photoUrl ? (
              <div className="relative w-full h-52 rounded-xl overflow-hidden border border-gray-200">
                <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
                <button 
                  type="button"
                  onClick={() => setPhotoUrl(null)}
                  className="absolute top-2 right-2 bg-white/95 text-red-600 p-2 rounded-full shadow hover:bg-white transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-44 border-2 border-dashed border-[#0C513F]/20 rounded-2xl cursor-pointer bg-[#FAF6EB]/50 hover:bg-[#FAF6EB] hover:border-[#0C513F]/50 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-gray-500">
                  <span className="text-3xl mb-2">📸</span>
                  <p className="text-sm font-bold text-[#0C513F]">Select photo from gallery</p>
                  <p className="text-xs text-[#6E6D66] mt-0.5">JPG, PNG, WebP or GIF</p>
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
              </label>
            )}
          </section>

          {/* Section 2: Basic Info */}
          <section className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
            <h2 className="font-display font-bold text-lg text-[#111111] mb-4">Dish Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#111111] mb-1.5">Food Name *</label>
                <input 
                  type="text" required
                  value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Special Party Jollof & Peppered Goat Meat"
                  className="w-full bg-[#FAF6EB]/40 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#0C513F]/20 focus:border-[#0C513F] outline-none text-sm transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#111111] mb-1.5">Description (Optional)</label>
                <textarea 
                  value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Freshly prepared firewood jollof rice served with spicy fried dodo..."
                  rows={3}
                  className="w-full bg-[#FAF6EB]/40 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#0C513F]/20 focus:border-[#0C513F] outline-none text-sm transition-all resize-none"
                ></textarea>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#111111] mb-1.5">Category *</label>
                <select 
                  value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full bg-[#FAF6EB]/40 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#0C513F]/20 focus:border-[#0C513F] outline-none text-sm font-medium"
                >
                  <option value="rice">Rice Dishes</option>
                  <option value="soups">Soups & Swallows</option>
                  <option value="grills">Suya & Grills</option>
                  <option value="shawarma">Shawarma & Burgers</option>
                  <option value="snacks">Snacks & Pastries</option>
                  <option value="drinks">Drinks & Beverages</option>
                  <option value="others">Other Dishes</option>
                </select>
              </div>
            </div>
          </section>

          {/* Section 3: Pricing */}
          <section className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
            <h2 className="font-display font-bold text-lg text-[#111111] mb-4">Pricing</h2>
            
            <div className="flex p-1 bg-[#FAF6EB] rounded-xl mb-5 border border-gray-200/60">
              <button 
                type="button" 
                onClick={() => setPriceType('plate')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${priceType === 'plate' ? 'bg-white shadow-sm text-[#0C513F]' : 'text-[#6E6D66]'}`}
              >
                Price per Plate 🍽️
              </button>
              <button 
                type="button" 
                onClick={() => setPriceType('scoop')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${priceType === 'scoop' ? 'bg-white shadow-sm text-[#0C513F]' : 'text-[#6E6D66]'}`}
              >
                Price per Scoop 🥄
              </button>
            </div>

            {priceType === 'plate' ? (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#111111] mb-1.5">Price in Naira (₦) *</label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-[#6E6D66] font-bold">₦</span>
                  <input 
                    type="number" required min="100"
                    value={singlePrice} onChange={e => setSinglePrice(e.target.value)}
                    placeholder="2500"
                    className="w-full bg-[#FAF6EB]/40 border border-gray-200 rounded-xl pl-9 pr-4 py-3 focus:ring-2 focus:ring-[#0C513F]/20 focus:border-[#0C513F] outline-none text-base font-bold"
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
                        className="w-full bg-[#FAF6EB]/40 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#0C513F]/20 focus:border-[#0C513F] outline-none"
                      />
                    </div>
                    <div className="flex-1 relative">
                      <span className="absolute left-4 top-3 text-[#6E6D66] font-bold">₦</span>
                      <input 
                        type="number" required min="50" placeholder="500"
                        value={scoop.price} onChange={e => updateScoop(scoop.id, 'price', e.target.value)}
                        className="w-full bg-[#FAF6EB]/40 border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[#0C513F]/20 focus:border-[#0C513F] outline-none"
                      />
                    </div>
                    {index > 0 && (
                      <button type="button" onClick={() => removeScoop(scoop.id)} className="text-red-500 p-2 hover:bg-red-50 rounded-lg">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addScoop} className="text-[#0C513F] font-bold text-xs flex items-center gap-1 mt-2 hover:underline">
                  + Add scoop variant
                </button>
              </div>
            )}
          </section>

          {/* Section 4: Compulsory Extras */}
          <section className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
            <div className="mb-4">
              <h2 className="font-display font-bold text-lg text-[#111111]">Required Add-ons (Proteins / Sides)</h2>
              <p className="text-xs text-[#6E6D66]">e.g. Choose Fried Chicken (₦1,500), Fried Fish (₦1,200)</p>
            </div>

            <div className="space-y-4">
              {compulsoryGroups.map((group) => (
                <div key={group.id} className="p-4 border border-gray-200 rounded-xl bg-[#FAF6EB]/40">
                  <div className="flex items-center gap-3 mb-3">
                    <input 
                      type="text" placeholder="Group Name (e.g. Choice of Protein)" required
                      value={group.name} onChange={e => updateCompulsoryGroup(group.id, e.target.value)}
                      className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-[#0C513F]/20 focus:border-[#0C513F] outline-none font-bold"
                    />
                    <button type="button" onClick={() => removeCompulsoryGroup(group.id)} className="text-red-500 p-2 hover:bg-red-50 rounded-lg">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                  
                  <div className="space-y-2.5 pl-3 border-l-2 border-[#0C513F]/20">
                    {group.options.map((option, idx) => (
                      <div key={option.id} className="flex items-center gap-3">
                        <input 
                          type="text" placeholder="Option name (e.g. Peppered Chicken)" required
                          value={option.name} onChange={e => updateCompulsoryOption(group.id, option.id, 'name', e.target.value)}
                          className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-[#0C513F]/20 focus:border-[#0C513F] outline-none"
                        />
                        <div className="w-1/3 relative">
                          <span className="absolute left-3 top-2 text-[#6E6D66] font-bold text-xs">₦</span>
                          <input 
                            type="number" min="0" placeholder="1500" required
                            value={option.price} onChange={e => updateCompulsoryOption(group.id, option.id, 'price', e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-xs font-bold focus:ring-2 focus:ring-[#0C513F]/20 focus:border-[#0C513F] outline-none"
                          />
                        </div>
                        {idx > 0 && (
                          <button type="button" onClick={() => removeCompulsoryOption(group.id, option.id)} className="text-gray-400 hover:text-red-500 p-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => addCompulsoryOption(group.id)} className="text-[#0C513F] font-bold text-xs flex items-center gap-1 hover:underline pt-1">
                      + Add protein/option
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addCompulsoryGroup} className="w-full py-2.5 border-2 border-dashed border-[#0C513F]/20 rounded-xl text-[#0C513F] font-bold text-xs hover:border-[#0C513F]/50 hover:bg-[#FAF6EB] transition-colors flex items-center justify-center gap-1.5">
                + Add Required Group
              </button>
            </div>
          </section>

          {/* Section 5: Optional Extras */}
          <section className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
            <div className="mb-4">
              <h2 className="font-display font-bold text-lg text-[#111111]">Optional Extras</h2>
              <p className="text-xs text-[#6E6D66]">e.g. Extra Plantain (₦700), Cold Chivita (₦500)</p>
            </div>

            <div className="space-y-3">
              {optionalExtras.map((extra) => (
                <div key={extra.id} className="flex items-center gap-3">
                  <input 
                    type="text" placeholder="Extra item name" required
                    value={extra.name} onChange={e => updateOptionalExtra(extra.id, 'name', e.target.value)}
                    className="flex-1 bg-[#FAF6EB]/40 border border-gray-200 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-[#0C513F]/20 focus:border-[#0C513F] outline-none"
                  />
                  <div className="w-1/3 relative">
                    <span className="absolute left-4 top-2.5 text-[#6E6D66] font-bold text-xs">₦</span>
                    <input 
                      type="number" min="0" placeholder="500" required
                      value={extra.price} onChange={e => updateOptionalExtra(extra.id, 'price', e.target.value)}
                      className="w-full bg-[#FAF6EB]/40 border border-gray-200 rounded-xl pl-8 pr-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-[#0C513F]/20 focus:border-[#0C513F] outline-none"
                    />
                  </div>
                  <button type="button" onClick={() => removeOptionalExtra(extra.id)} className="text-red-500 p-2 hover:bg-red-50 rounded-lg">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              ))}
              <button type="button" onClick={addOptionalExtra} className="text-[#0C513F] font-bold text-xs flex items-center gap-1 hover:underline">
                + Add optional extra
              </button>
            </div>
          </section>

          {/* Section 6: Preorder & Availability */}
          <section className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-sm text-[#111111]">Currently In Stock</h3>
                <p className="text-xs text-[#6E6D66]">Turn off when sold out</p>
              </div>
              <Switch checked={isAvailable} onChange={setIsAvailable} />
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-sm text-[#111111]">Available for Pre-order</h3>
                <p className="text-xs text-[#6E6D66]">Allow students to book before food is ready</p>
              </div>
              <Switch checked={isPreorder} onChange={setIsPreorder} />
            </div>

            {isPreorder && (
              <div className="pt-2">
                <input 
                  type="text" 
                  value={preorderNote} onChange={e => setPreorderNote(e.target.value)}
                  placeholder="e.g. Ready daily by 1:00 PM"
                  className="w-full bg-[#FAF6EB]/40 border border-gray-200 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-[#0C513F]/20 focus:border-[#0C513F] outline-none"
                />
              </div>
            )}
          </section>
        </div>

        {/* Submit Button */}
        <div className="mt-8 flex justify-end">
          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto bg-[#0C513F] hover:bg-[#073B2E] text-white font-extrabold text-base px-8 py-3.5 rounded-full transition-all shadow-[0_6px_20px_rgba(12,81,63,0.22)] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Saving Dish...
              </>
            ) : (
              'Save & Publish Food Item →'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
