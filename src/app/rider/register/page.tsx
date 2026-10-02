'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { riderAuthClient } from '@/lib/auth-client';

const CAMPUSES = [
  'OOU Sagamu Campus',
  'OOU Ago-Iwoye Main Campus',
  'OOU Ibogun Campus',
  'UNILAG Akoka',
  'LASU Ojo',
  'FUTA Akure',
  'UI Ibadan',
  'Babcock University',
  'Covenant University',
  'Other Campus / Tech Hub',
];

const VEHICLE_TYPES = [
  { id: 'Bicycle', label: 'Bicycle', icon: '🚲', desc: 'Fast, campus-friendly, zero fuel costs' },
  { id: 'E-bike / Scooter', label: 'E-bike / Scooter', icon: '🛴', desc: 'Electric agility for hostel runs' },
  { id: 'Motorcycle', label: 'Motorcycle (Okada)', icon: '🏍️', desc: 'High range and high capacity' },
  { id: 'Car', label: 'Car / Sedan', icon: '🚗', desc: 'Bulk catering and rainy day delivery' },
  { id: 'Walker', label: 'Walker / On-Foot', icon: '👟', desc: 'Hostel-to-hostel short range runs' },
];

export default function RiderRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const [vehicle, setVehicle] = useState('Bicycle');
  const [institution, setInstitution] = useState('OOU Sagamu Campus');
  const [location, setLocation] = useState('Sagamu Campus');

  const [identityMethod, setIdentityMethod] = useState<'NIN' | 'MATRIC'>('NIN');
  const [identityNumber, setIdentityNumber] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        setError('Photo size must be under 4MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setAvatar(result);
        setAvatarPreview(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const validateStep = (currentStep: number) => {
    setError(null);
    if (currentStep === 1) {
      if (!name.trim() || name.trim().length < 3) {
        setError('Please enter your full legal name.');
        return false;
      }
      if (!email.trim() || !email.includes('@') || !email.includes('.')) {
        setError('Please provide a valid email address.');
        return false;
      }
      if (!phone.trim() || phone.trim().length < 10) {
        setError('Please enter a valid phone number.');
        return false;
      }
      if (!password || password.length < 6) {
        setError('Password must be at least 6 characters.');
        return false;
      }
    } else if (currentStep === 2) {
      if (!vehicle) {
        setError('Please choose a vehicle type.');
        return false;
      }
      if (!institution) {
        setError('Please choose your primary campus hub.');
        return false;
      }
    } else if (currentStep === 3) {
      if (!identityNumber.trim()) {
        setError(
          identityMethod === 'NIN'
            ? 'Please enter your 11-digit National Identification Number (NIN).'
            : 'Please enter your university Matriculation Number.'
        );
        return false;
      }
      if (identityMethod === 'NIN' && identityNumber.replace(/\D/g, '').length !== 11) {
        setError('NIN must be exactly 11 numeric digits.');
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep((s) => Math.min(4, s + 1));
    }
  };

  const prevStep = () => {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms) {
      setError('You must accept the Chow45 Rider Code of Conduct and Service Terms.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/rider/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          password,
          vehicle,
          institution,
          location,
          identityMethod,
          identityNumber: identityNumber.trim(),
          avatar,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit application');
      }

      // Try signing in immediately with credentials
      try {
        await riderAuthClient.signIn.email({
          email: email.trim().toLowerCase(),
          password,
        });
      } catch (signInErr) {
        console.warn('Auto-sign in notice:', signInErr);
      }

      router.push('/rider/application-status');
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6EB] text-[#111111] flex flex-col justify-between selection:bg-[#0C513F] selection:text-white font-sans antialiased">
      {/* Branded Header */}
      <header className="sticky top-0 z-30 bg-[#FAF6EB]/90 backdrop-blur-md border-b border-[#0C513F]/10 px-4 py-3 sm:px-6">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="w-8 h-8 rounded-full bg-[#0C513F] text-white flex items-center justify-center font-black text-sm tracking-tighter group-hover:scale-105 transition-transform">
              45
            </span>
            <span className="font-bold text-lg tracking-tight text-[#0C513F]">
              CHOW<span className="text-[#E75A24]">45</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-[#0C513F]/70 bg-[#0C513F]/5 px-2.5 py-1 rounded-full border border-[#0C513F]/10">
              Rider Dispatch
            </span>
            <Link
              href="/rider/login"
              className="text-xs font-bold text-[#0C513F] hover:underline"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Main Multi-Step Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-xl bg-[#FFFDF6] rounded-3xl border border-[#0C513F]/10 shadow-xl shadow-[#0C513F]/5 p-6 sm:p-8">
          {/* Progress Indicator */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#0C513F]/70 mb-2">
              <span>Step {step} of 4</span>
              <span>
                {step === 1 && 'Account Details'}
                {step === 2 && 'Vehicle & Campus'}
                {step === 3 && 'Identity & Photo'}
                {step === 4 && 'Pledge & Submit'}
              </span>
            </div>
            <div className="w-full bg-[#FAF6EB] rounded-full h-2 overflow-hidden border border-[#0C513F]/10">
              <div
                className="bg-[#0C513F] h-2 transition-all duration-300 rounded-full"
                style={{ width: `${(step / 4) * 100}%` }}
              />
            </div>
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0C513F]">
              {step === 1 && 'Join the Chow45 Fleet 🚀'}
              {step === 2 && 'Your Wheels & Campus Hub'}
              {step === 3 && 'Verification & Security'}
              {step === 4 && 'Review & Dispatch Pledge'}
            </h1>
            <p className="text-sm text-[#111111]/70 mt-1">
              {step === 1 && 'Earn up to ₦60,000+ weekly delivering meals to fellow students and staff.'}
              {step === 2 && 'Tell us how you roll and where you prefer to fulfill orders.'}
              {step === 3 && 'Select NIN or Matriculation Number to protect food packages & community trust.'}
              {step === 4 && 'Confirm your profile details and sign the rider safety pledge.'}
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* STEP 1: ACCOUNT DETAILS */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#0C513F] mb-1">
                    Full Legal Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Samuel Olawale Adeleke"
                    className="w-full px-4 py-3 rounded-xl bg-[#FAF6EB] border border-[#0C513F]/20 text-[#111111] placeholder-[#111111]/40 focus:outline-none focus:ring-2 focus:ring-[#0C513F] text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0C513F] mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. samuel.adeleke@gmail.com"
                    className="w-full px-4 py-3 rounded-xl bg-[#FAF6EB] border border-[#0C513F]/20 text-[#111111] placeholder-[#111111]/40 focus:outline-none focus:ring-2 focus:ring-[#0C513F] text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0C513F] mb-1">
                    WhatsApp / Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 08012345678"
                    className="w-full px-4 py-3 rounded-xl bg-[#FAF6EB] border border-[#0C513F]/20 text-[#111111] placeholder-[#111111]/40 focus:outline-none focus:ring-2 focus:ring-[#0C513F] text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0C513F] mb-1">
                    Create Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-4 py-3 rounded-xl bg-[#FAF6EB] border border-[#0C513F]/20 text-[#111111] placeholder-[#111111]/40 focus:outline-none focus:ring-2 focus:ring-[#0C513F] text-sm"
                  />
                </div>
              </div>
            )}

            {/* STEP 2: VEHICLE & CAMPUS */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#0C513F] mb-2">
                    Select Your Delivery Vehicle
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {VEHICLE_TYPES.map((v) => (
                      <button
                        type="button"
                        key={v.id}
                        onClick={() => setVehicle(v.id)}
                        className={`text-left p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
                          vehicle === v.id
                            ? 'bg-[#0C513F] text-white border-[#0C513F] shadow-md shadow-[#0C513F]/20'
                            : 'bg-[#FAF6EB] text-[#111111] border-[#0C513F]/15 hover:border-[#0C513F]/40'
                        }`}
                      >
                        <span className="text-2xl">{v.icon}</span>
                        <div>
                          <p className="font-bold text-sm leading-tight">{v.label}</p>
                          <p className={`text-xs mt-0.5 ${vehicle === v.id ? 'text-white/80' : 'text-[#111111]/60'}`}>
                            {v.desc}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <label className="block text-xs font-bold text-[#0C513F] mb-1">
                    Primary University / Campus Hub
                  </label>
                  <select
                    value={institution}
                    onChange={(e) => {
                      setInstitution(e.target.value);
                      setLocation(e.target.value);
                    }}
                    className="w-full px-4 py-3 rounded-xl bg-[#FAF6EB] border border-[#0C513F]/20 text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#0C513F] text-sm font-medium"
                  >
                    {CAMPUSES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* STEP 3: IDENTITY & PHOTO */}
            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-[#0C513F] mb-2">
                    Identity Verification Method
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setIdentityMethod('NIN')}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        identityMethod === 'NIN'
                          ? 'bg-[#0C513F] text-white border-[#0C513F] font-bold'
                          : 'bg-[#FAF6EB] text-[#111111] border-[#0C513F]/20 font-semibold'
                      }`}
                    >
                      <span className="block text-sm">National ID (NIN)</span>
                      <span className={`text-[10px] ${identityMethod === 'NIN' ? 'text-white/80' : 'text-[#111111]/60'}`}>
                        All Nigerian Citizens
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIdentityMethod('MATRIC')}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        identityMethod === 'MATRIC'
                          ? 'bg-[#0C513F] text-white border-[#0C513F] font-bold'
                          : 'bg-[#FAF6EB] text-[#111111] border-[#0C513F]/20 font-semibold'
                      }`}
                    >
                      <span className="block text-sm">Matriculation No.</span>
                      <span className={`text-[10px] ${identityMethod === 'MATRIC' ? 'text-white/80' : 'text-[#111111]/60'}`}>
                        Enrolled Students
                      </span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0C513F] mb-1">
                    {identityMethod === 'NIN'
                      ? 'National Identification Number (11 Digits)'
                      : 'Campus Matriculation Number'}
                  </label>
                  <input
                    type="text"
                    required
                    value={identityNumber}
                    onChange={(e) => setIdentityNumber(e.target.value)}
                    placeholder={
                      identityMethod === 'NIN' ? 'e.g. 12345678901' : 'e.g. SCI/2021/0452'
                    }
                    className="w-full px-4 py-3 rounded-xl bg-[#FAF6EB] border border-[#0C513F]/20 text-[#111111] placeholder-[#111111]/40 focus:outline-none focus:ring-2 focus:ring-[#0C513F] text-sm font-mono"
                  />
                  <p className="text-[11px] text-[#111111]/60 mt-1">
                    🔒 Kept strictly confidential and encrypted. Used only for rider background check.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0C513F] mb-1">
                    Clear Rider Face Profile Photo
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-[#FAF6EB] border border-[#0C513F]/20 flex items-center justify-center overflow-hidden shrink-0">
                      {avatarPreview ? (
                        <img
                          src={avatarPreview}
                          alt="Rider avatar preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl">👤</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        id="photo-upload"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                      <label
                        htmlFor="photo-upload"
                        className="inline-block px-4 py-2 rounded-xl bg-[#0C513F]/10 hover:bg-[#0C513F]/15 border border-[#0C513F]/20 text-[#0C513F] font-bold text-xs cursor-pointer transition-colors"
                      >
                        {avatarPreview ? 'Change Photo' : 'Upload Headshot'}
                      </label>
                      <p className="text-[11px] text-[#111111]/60 mt-1">
                        A recognizable headshot so students and restaurant vendors can identify you.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: REVIEW & DISPATCH PLEDGE */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-[#FAF6EB] border border-[#0C513F]/15 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-[#0C513F]/10">
                    <span className="text-[#111111]/60">Rider Name:</span>
                    <span className="font-bold text-[#0C513F]">{name}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#0C513F]/10">
                    <span className="text-[#111111]/60">Contact Email:</span>
                    <span className="font-semibold">{email}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#0C513F]/10">
                    <span className="text-[#111111]/60">Phone:</span>
                    <span className="font-semibold">{phone}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#0C513F]/10">
                    <span className="text-[#111111]/60">Vehicle:</span>
                    <span className="font-bold text-[#E75A24]">{vehicle}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#0C513F]/10">
                    <span className="text-[#111111]/60">Campus Hub:</span>
                    <span className="font-semibold">{institution}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#111111]/60">Verification:</span>
                    <span className="font-mono font-bold text-[#0C513F]">
                      {identityMethod}: {identityNumber}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#0C513F]/5 border border-[#0C513F]/15">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#0C513F] mb-1.5 flex items-center gap-1.5">
                    <span>🛡️</span> Chow45 Dispatch & Food Safety Pledge
                  </h3>
                  <ul className="text-xs text-[#111111]/80 space-y-1 list-disc list-inside">
                    <li>I will handle meal packages with care and maintain food hygiene.</li>
                    <li>I will promptly confirm deliveries using the customer&apos;s 4-digit PIN.</li>
                    <li>I will treat cafeteria staff and campus students with courtesy.</li>
                  </ul>
                  <label className="mt-3 flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="mt-0.5 rounded border-[#0C513F]/30 text-[#0C513F] focus:ring-[#0C513F] h-4 w-4"
                    />
                    <span className="text-xs font-bold text-[#0C513F]">
                      I accept the terms and promise to fulfill deliveries responsibly.
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="mt-8 flex items-center justify-between gap-3">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={loading}
                  className="px-5 py-3 rounded-xl border border-[#0C513F]/20 text-[#0C513F] font-bold text-xs hover:bg-[#FAF6EB] transition-colors"
                >
                  ← Back
                </button>
              ) : (
                <Link
                  href="/rider/login"
                  className="text-xs font-bold text-[#0C513F] hover:underline"
                >
                  Already registered?
                </Link>
              )}

              {step < 4 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="px-6 py-3 rounded-xl bg-[#0C513F] hover:bg-[#0a4334] text-white font-bold text-xs shadow-md shadow-[#0C513F]/20 transition-all ml-auto"
                >
                  Continue →
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading || !agreedToTerms}
                  className="px-7 py-3 rounded-xl bg-[#0C513F] hover:bg-[#0a4334] disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-[#0C513F]/20 transition-all ml-auto flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Submit Application 🚀</span>
                  )}
                </button>
              )}
            </div>
          </form>
        </div>
      </main>

      {/* Footer Note */}
      <footer className="py-4 text-center text-xs text-[#111111]/50 border-t border-[#0C513F]/10">
        Chow45 Campus Logistics & Food Delivery Operations • Powered by Student Riders
      </footer>
    </div>
  );
}
