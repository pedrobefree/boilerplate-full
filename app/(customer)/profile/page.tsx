"use client";

import { useEffect, useState } from "react";
import { getMyProfile, updateMyProfile, ProfileUpdateParams } from "@/app/actions/profiles";
import { getMyPaymentMethods, deletePaymentMethod } from "@/app/actions/stripe";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { User, MapPin, CreditCard, Save, Trash2, Mail, Phone, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export default function CustomerProfilePage() {
    const [profile, setProfile] = useState<any>(null);
    const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    
    // PM deletion state
    const [pmToDelete, setPmToDelete] = useState<string | null>(null);
    const [deletingPm, setDeletingPm] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [profileRes, pmRes] = await Promise.all([
                    getMyProfile(),
                    getMyPaymentMethods()
                ]);

                if (!profileRes.success) {
                    setError(profileRes.error);
                } else {
                    setProfile(profileRes.data);
                }
                setPaymentMethods(pmRes || []);
            } catch (err: any) {
                console.error("Error fetching profile data:", err);
                setError(err.message || "Failed to load profile data");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setSuccess(null);

        const formData = new FormData(e.currentTarget);
        const updates: ProfileUpdateParams = {
            full_name: formData.get('full_name') as string,
            phone: formData.get('phone') as string,
            address_line1: formData.get('address_line1') as string,
            address_line2: formData.get('address_line2') as string,
            city: formData.get('city') as string,
            state: formData.get('state') as string,
            zip: formData.get('zip') as string,
            country: formData.get('country') as string,
        };

        try {
            const res = await updateMyProfile(updates);
            if (!res.success) {
                setError(res.error);
            } else {
                setSuccess("Profile updated successfully!");
                setProfile(res.data);
            }
        } catch (err: any) {
            setError(err.message || "Failed to update profile");
        } finally {
            setSaving(false);
        }
    };

    const handleDeletePm = async () => {
        if (!pmToDelete) return;
        setDeletingPm(true);
        try {
            const res = await deletePaymentMethod(pmToDelete);
            if (res.success) {
                setPaymentMethods(prev => prev.filter(pm => pm.id !== pmToDelete));
                setPmToDelete(null);
            } else {
                alert(res.error || "Failed to delete payment method");
            }
        } catch (error: any) {
            alert(error.message || "An error occurred while deleting payment method");
        } finally {
            setDeletingPm(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <LoadingIndicator size="lg" />
                <p className="mt-4 text-gray-500">Loading your profile...</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-12">
            <div>
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Your Profile</h1>
                <p className="text-gray-500 mt-1">Manage your personal information and saved payment methods.</p>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 font-medium">
                    {error}
                </div>
            )}
            
            {success && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 font-medium">
                    {success}
                </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-8">
                {/* Personal Info */}
                <section className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 bg-brand-50 rounded-xl text-brand-600">
                            <User className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">Personal Information</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label htmlFor="full_name" className="text-sm font-semibold text-gray-700">Full Name</label>
                            <Input 
                                id="full_name" 
                                name="full_name" 
                                defaultValue={profile?.full_name || ""} 
                                placeholder="E.g. John Doe" 
                            />
                        </div>
                        
                        <div className="space-y-2">
                            <label htmlFor="email" className="text-sm font-semibold text-gray-700">Email Address (Read Only)</label>
                            <div className="relative">
                                <Input 
                                    id="email" 
                                    disabled 
                                    value={profile?.email || ""} 
                                    className="bg-gray-50 text-gray-400 pl-10"
                                />
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="phone" className="text-sm font-semibold text-gray-700">Phone Number</label>
                            <div className="relative">
                                <Input 
                                    id="phone" 
                                    name="phone" 
                                    defaultValue={profile?.phone || ""} 
                                    placeholder="+1 (555) 000-0000" 
                                    className="pl-10"
                                />
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Address */}
                <section className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 bg-brand-50 rounded-xl text-brand-600">
                            <MapPin className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">Shipping Address</h2>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-2">
                            <label htmlFor="address_line1" className="text-sm font-semibold text-gray-700">Address Line 1</label>
                            <Input 
                                id="address_line1" 
                                name="address_line1" 
                                defaultValue={profile?.address_line1 || ""} 
                                placeholder="E.g. 123 Main St" 
                            />
                        </div>
                        
                        <div className="space-y-2">
                            <label htmlFor="address_line2" className="text-sm font-semibold text-gray-700">Address Line 2 (Optional)</label>
                            <Input 
                                id="address_line2" 
                                name="address_line2" 
                                defaultValue={profile?.address_line2 || ""} 
                                placeholder="E.g. Apt 4B" 
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label htmlFor="city" className="text-sm font-semibold text-gray-700">City</label>
                            <Input 
                                id="city" 
                                name="city" 
                                defaultValue={profile?.city || ""} 
                                placeholder="E.g. New York" 
                            />
                        </div>
                        
                        <div className="space-y-2">
                            <label htmlFor="state" className="text-sm font-semibold text-gray-700">State / Province</label>
                            <Input 
                                id="state" 
                                name="state" 
                                defaultValue={profile?.state || ""} 
                                placeholder="E.g. NY" 
                            />
                        </div>
                        
                        <div className="space-y-2">
                            <label htmlFor="zip" className="text-sm font-semibold text-gray-700">ZIP / Postal Code</label>
                            <Input 
                                id="zip" 
                                name="zip" 
                                defaultValue={profile?.zip || ""} 
                                placeholder="E.g. 10001" 
                            />
                        </div>
                    </div>

                    <div className="space-y-2 max-w-xs">
                        <label htmlFor="country" className="text-sm font-semibold text-gray-700">Country</label>
                        <div className="relative">
                            <Input 
                                id="country" 
                                name="country" 
                                defaultValue={profile?.country || ""} 
                                placeholder="E.g. USA" 
                                className="pl-10"
                            />
                            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        </div>
                    </div>
                </section>

                <div className="flex justify-end pt-4">
                    <Button type="submit" size="xl" className="h-14 px-10 shadow-lg shadow-brand-100" isDisabled={saving}>
                        {saving ? (
                            <><LoadingIndicator size="sm" className="mr-2" /> Saving...</>
                        ) : (
                            <><Save className="w-5 h-5 mr-2" /> Save Profile Changes</>
                        )}
                    </Button>
                </div>
            </form>

            <span className="block border-t border-gray-100 mx-auto" aria-hidden="true" />

            {/* Payment Methods */}
            <section className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-brand-50 rounded-xl text-brand-600">
                            <CreditCard className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">Saved Payment Methods</h2>
                    </div>
                    <p className="text-sm text-gray-500">Collected via Stripe during checkout.</p>
                </div>

                {paymentMethods.length === 0 ? (
                    <div className="border-2 border-dashed border-gray-100 rounded-2xl p-12 text-center">
                        <div className="mx-auto w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                            <CreditCard className="w-6 h-6 text-gray-300" />
                        </div>
                        <h3 className="font-bold text-gray-900 mb-1">No payment methods saved</h3>
                        <p className="text-sm text-gray-500">Payment methods will appear here after your first successful checkout.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {paymentMethods.map((pm) => (
                            <div 
                                key={pm.id} 
                                className="group flex items-center justify-between p-4 bg-gray-50/50 border border-gray-100 rounded-xl hover:border-brand-200 transition-all hover:bg-white hover:shadow-sm"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-8 bg-white border border-gray-200 rounded flex items-center justify-center font-bold text-[10px] uppercase text-gray-400">
                                        {pm.brand}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">•••• •••• •••• {pm.last4}</p>
                                        <p className="text-xs text-gray-500">Expires {pm.exp_month}/{pm.exp_year}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setPmToDelete(pm.id)}
                                    className="p-2 text-gray-300 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
                                    title="Delete payment method"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <ConfirmDialog 
                isOpen={!!pmToDelete}
                onClose={() => setPmToDelete(null)}
                onConfirm={handleDeletePm}
                title="Remove Payment Method"
                description="Are you sure you want to remove this card? You'll need to enter your details again for your next purchase."
                confirmText="Yes, Remove Card"
                variant="destructive"
                isLoading={deletingPm}
            />
        </div>
    );
}
