import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, FileText, CheckCircle, Clock, ShieldCheck, UserCheck, Key, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import {
    useEmployee, useCreateEmployee, useUpdateEmployee,
    useDepartments, useDesignations, useShifts, useSalaryStructures, useLeaveStructures,
} from '../features/hr/useHr';

const tabs = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'contact', label: 'Contact Details (සම්බන්ධ කරගන්නා අංක 3)' },
    { id: 'employment', label: 'Employment' },
    { id: 'user_login', label: 'System Login (ලොගින් ගිණුම)' },
    { id: 'documents', label: 'Documents (අවශ්‍ය ලේඛන)' },
    { id: 'statutory', label: 'Statutory & Bank' },
    { id: 'compensation', label: 'Compensation & Labour Rate' },
];

export default function EmployeeFormPage() {
    const { id } = useParams();
    const isEdit = !!id;
    const navigate = useNavigate();
    const [tab, setTab] = useState('basic');

    const createMutation = useCreateEmployee();
    const updateMutation = useUpdateEmployee();
    const { data: existingData } = useEmployee(id);
    const { data: deptsData } = useDepartments();
    const { data: designationsData } = useDesignations();
    const { data: shiftsData } = useShifts();
    const { data: structuresData } = useSalaryStructures({ isActive: 'true' });
    const { data: leavesData } = useLeaveStructures({ isActive: 'true' });

    const [form, setForm] = useState({
        firstName: '', lastName: '', gender: '', dateOfBirth: '', nationalIdNumber: '',
        maritalStatus: '', nationality: 'Sri Lankan', bloodGroup: '',
        email: '', phone: '', secondaryPhone: '', tertiaryPhone: '', mobile: '',
        permanentAddress: { line1: '', city: '', postalCode: '' },
        currentAddress: { line1: '', city: '', postalCode: '' },
        emergencyContact: { name: '', relationship: '', phone: '' },
        departmentId: '', designationId: '', reportsToId: '',
        employmentType: 'permanent', dateOfJoining: '', probationEndDate: '',
        workLocation: '', workShift: '',
        paymentType: 'monthly',
        labourRate: 0,
        epfNumber: '', etfNumber: '', taxRegistrationNumber: '',
        bankDetails: { bankName: '', branchName: '', accountNumber: '', accountName: '' },
        salaryStructureId: '', leaveStructureId: '', basicSalary: 0,
        status: 'active',
        notes: '',
        employeeCategory: 'Permanent',
        epfRate: 8,
        etfRate: 3,
        basicWageRate: 0,
        otCutoffHours: 45,
        gsCertificate: { status: 'pending', certificateNo: '', issueDate: '', url: '', notes: '' },
        educationCertificates: { status: 'pending', summary: '', url: '', notes: '' },
        policeReport: { status: 'pending', reportNo: '', issueDate: '', expiryDate: '', url: '', notes: '' },
        createLogin: false,
        loginEmail: '',
        loginPassword: '',
        loginRole: 'employee',
    });

    useEffect(() => {
        if (isEdit && existingData?.data) {
            const e = existingData.data;
            setForm({
                ...form,
                firstName: e.firstName || '', lastName: e.lastName || '',
                gender: e.gender || '', dateOfBirth: e.dateOfBirth ? e.dateOfBirth.slice(0, 10) : '',
                nationalIdNumber: e.nationalIdNumber || '',
                maritalStatus: e.maritalStatus || '', nationality: e.nationality || 'Sri Lankan',
                bloodGroup: e.bloodGroup || '',
                email: e.email || '', phone: e.phone || '', secondaryPhone: e.secondaryPhone || '', tertiaryPhone: e.tertiaryPhone || '', mobile: e.mobile || '',
                permanentAddress: e.permanentAddress || { line1: '', city: '', postalCode: '' },
                currentAddress: e.currentAddress || { line1: '', city: '', postalCode: '' },
                emergencyContact: e.emergencyContact || { name: '', relationship: '', phone: '' },
                departmentId: e.departmentId?._id || '', designationId: e.designationId?._id || '',
                reportsToId: e.reportsToId?._id || '',
                employmentType: e.employmentType || 'permanent',
                dateOfJoining: e.dateOfJoining ? e.dateOfJoining.slice(0, 10) : '',
                probationEndDate: e.probationEndDate ? e.probationEndDate.slice(0, 10) : '',
                workLocation: e.workLocation || '', workShift: e.workShift?._id || '',
                paymentType: e.paymentType || 'monthly',
                labourRate: e.labourRate || 0,
                epfNumber: e.epfNumber || '', etfNumber: e.etfNumber || '',
                taxRegistrationNumber: e.taxRegistrationNumber || '',
                bankDetails: e.bankDetails || { bankName: '', branchName: '', accountNumber: '', accountName: '' },
                salaryStructureId: e.salaryStructureId?._id || '',
                leaveStructureId: e.leaveStructureId?._id || '',
                basicSalary: e.basicSalary || 0,
                status: e.status || 'active',
                notes: e.notes || '',
                employeeCategory: e.employeeCategory || 'Permanent',
                epfRate: e.epfRate !== undefined ? e.epfRate : 8,
                etfRate: e.etfRate !== undefined ? e.etfRate : 3,
                basicWageRate: e.basicWageRate || 0,
                otCutoffHours: e.otCutoffHours !== undefined ? e.otCutoffHours : 45,
                gsCertificate: {
                    status: e.gsCertificate?.status || 'pending',
                    certificateNo: e.gsCertificate?.certificateNo || '',
                    issueDate: e.gsCertificate?.issueDate ? e.gsCertificate.issueDate.slice(0, 10) : '',
                    url: e.gsCertificate?.url || '',
                    notes: e.gsCertificate?.notes || '',
                },
                educationCertificates: {
                    status: e.educationCertificates?.status || 'pending',
                    summary: e.educationCertificates?.summary || '',
                    url: e.educationCertificates?.url || '',
                    notes: e.educationCertificates?.notes || '',
                },
                policeReport: {
                    status: e.policeReport?.status || 'pending',
                    reportNo: e.policeReport?.reportNo || '',
                    issueDate: e.policeReport?.issueDate ? e.policeReport.issueDate.slice(0, 10) : '',
                    expiryDate: e.policeReport?.expiryDate ? e.policeReport.expiryDate.slice(0, 10) : '',
                    url: e.policeReport?.url || '',
                    notes: e.policeReport?.notes || '',
                },
                createLogin: !!e.userId,
                loginEmail: e.userId?.email || e.email || '',
                loginRole: e.userId?.role || 'employee',
            });
        }
    }, [isEdit, existingData]);

    const update = (path, value) => {
        setForm((prev) => {
            const copy = { ...prev };
            const parts = path.split('.');
            if (parts.length === 1) copy[parts[0]] = value;
            else if (parts.length === 2) {
                copy[parts[0]] = { ...copy[parts[0]], [parts[1]]: value };
            } else if (parts.length === 3) {
                copy[parts[0]] = {
                    ...copy[parts[0]],
                    [parts[1]]: { ...copy[parts[0]][parts[1]], [parts[2]]: value }
                };
            }
            return copy;
        });
    };

    const submit = async () => {
        if (!form.firstName || !form.lastName || !form.dateOfJoining) {
            toast.error('First name, last name and date of joining are required');
            setTab('basic');
            return;
        }
        if (!form.phone || !form.secondaryPhone || !form.tertiaryPhone) {
            toast.error('සෑම සේවකයෙකුගෙන්ම දුරකථන අංක 3ක් (Contact 1, Contact 2 & Contact 3) ඇතුළත් කිරීම අනිවාර්ය වේ!');
            setTab('contact');
            return;
        }
        if (form.createLogin && (!isEdit || !existingData?.data?.userId)) {
            const emailToUse = form.loginEmail || form.email;
            if (!emailToUse) {
                toast.error('User login email address is required!');
                setTab('user_login');
                return;
            }
            if (!form.loginPassword || form.loginPassword.length < 6) {
                toast.error('Password for system user login must be at least 6 characters!');
                setTab('user_login');
                return;
            }
        }
        try {
            const payload = {
                ...form,
                basicSalary: +form.basicSalary || 0,
                labourRate: +form.labourRate || 0,
                departmentId: form.departmentId || undefined,
                designationId: form.designationId || undefined,
                reportsToId: form.reportsToId || undefined,
                workShift: form.workShift || undefined,
                salaryStructureId: form.salaryStructureId || undefined,
                leaveStructureId: form.leaveStructureId || undefined,
            };
            if (isEdit) {
                await updateMutation.mutateAsync({ id, data: payload });
                navigate(`/employees/${id}`);
            } else {
                const result = await createMutation.mutateAsync(payload);
                navigate(`/employees/${result.data._id}`);
            }
        } catch { }
    };

    const deptOptions = (deptsData?.data || []).map((d) => ({ value: d._id, label: d.name }));
    const designationOptions = (designationsData?.data || []).map((d) => ({ value: d._id, label: d.name }));
    const shiftOptions = (shiftsData?.data || []).map((s) => ({ value: s._id, label: s.name }));
    const structureOptions = (structuresData?.data || []).map((s) => ({ value: s._id, label: s.name }));
    const leaveStructureOptions = (leavesData?.data || []).map((l) => ({ value: l._id, label: l.name }));

    return (
        <div>
            <PageHeader
                title={isEdit ? 'Edit Employee / Labour Details' : 'New Employee / Labour Registration'}
                actions={<Button variant="outline" onClick={() => navigate('/employees')}>
                    <ArrowLeft size={16} className="mr-1.5" /> Back
                </Button>} />

            <Card>
                <div className="border-b flex gap-1 px-4 overflow-x-auto">
                    {tabs.map((t) => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${tab === t.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-600 hover:text-gray-900'
                                }`}>
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="p-3 sm:p-6 space-y-4">
                    {tab === 'basic' && (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <Input label="First Name" required value={form.firstName} onChange={(e) => update('firstName', e.target.value)} />
                                <Input label="Last Name" required value={form.lastName} onChange={(e) => update('lastName', e.target.value)} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                <Select label="Gender" placeholder="Select..."
                                    options={[
                                        { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' },
                                        { value: 'other', label: 'Other' }, { value: 'prefer_not_to_say', label: 'Prefer not to say' },
                                    ]}
                                    value={form.gender} onChange={(e) => update('gender', e.target.value)} />
                                <Input label="Date of Birth" type="date" value={form.dateOfBirth}
                                    onChange={(e) => update('dateOfBirth', e.target.value)} />
                                <Input label="NIC Number (ජාතික හැඳුනුම්පත් අංකය)" value={form.nationalIdNumber}
                                    onChange={(e) => update('nationalIdNumber', e.target.value)} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                <Select label="Marital Status" placeholder="Select..."
                                    options={[
                                        { value: 'single', label: 'Single' }, { value: 'married', label: 'Married' },
                                        { value: 'divorced', label: 'Divorced' }, { value: 'widowed', label: 'Widowed' },
                                        { value: 'separated', label: 'Separated' },
                                    ]}
                                    value={form.maritalStatus} onChange={(e) => update('maritalStatus', e.target.value)} />
                                <Input label="Nationality" value={form.nationality} onChange={(e) => update('nationality', e.target.value)} />
                                <Input label="Blood Group" value={form.bloodGroup} onChange={(e) => update('bloodGroup', e.target.value)} />
                            </div>
                        </>
                    )}

                    {tab === 'contact' && (
                        <>
                            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs sm:text-sm text-amber-900 mb-2">
                                📌 <strong>අවශ්‍යයි (Requirement):</strong> සෑම සේවකයෙකුගෙන්ම දුරකථන අංක 3ක් (Contact Number 1, Contact Number 2 සහ Contact Number 3) ඇතුළත් කිරීම අනිවාර්ය වේ.
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                <Input label="Primary Phone (සම්බන්ධ කරගන්නා අංකය 1)" required placeholder="e.g. 0771234567" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
                                <Input label="Secondary Phone (සම්බන්ධ කරගන්නා අංකය 2)" required placeholder="e.g. 0719876543" value={form.secondaryPhone} onChange={(e) => update('secondaryPhone', e.target.value)} />
                                <Input label="Third Phone (සම්බන්ධ කරගන්නා අංකය 3)" required placeholder="e.g. 0764567890" value={form.tertiaryPhone} onChange={(e) => update('tertiaryPhone', e.target.value)} />
                                <Input label="Email Address" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
                            </div>
                            <div>
                                <p className="text-sm font-semibold mb-2">Permanent Address (ස්ථිර ලිපිනය)</p>
                                <Input label="Line 1" value={form.permanentAddress.line1}
                                    onChange={(e) => update('permanentAddress.line1', e.target.value)} />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-2">
                                    <Input label="City" value={form.permanentAddress.city}
                                        onChange={(e) => update('permanentAddress.city', e.target.value)} />
                                    <Input label="Postal Code" value={form.permanentAddress.postalCode}
                                        onChange={(e) => update('permanentAddress.postalCode', e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <p className="text-sm font-semibold mb-2">Emergency Contact (හදිසි අවස්ථාවකදී)</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                    <Input label="Contact Name" value={form.emergencyContact.name}
                                        onChange={(e) => update('emergencyContact.name', e.target.value)} />
                                    <Input label="Relationship" value={form.emergencyContact.relationship}
                                        onChange={(e) => update('emergencyContact.relationship', e.target.value)} />
                                    <Input label="Phone" value={form.emergencyContact.phone}
                                        onChange={(e) => update('emergencyContact.phone', e.target.value)} />
                                </div>
                            </div>
                        </>
                    )}

                    {tab === 'employment' && (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <Select label="Department" placeholder="Select..." options={deptOptions}
                                    value={form.departmentId} onChange={(e) => update('departmentId', e.target.value)} />
                                <Select label="Designation" placeholder="Select..." options={designationOptions}
                                    value={form.designationId} onChange={(e) => update('designationId', e.target.value)} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <Select label="Employment Type"
                                    options={[
                                        { value: 'permanent', label: 'Permanent' },
                                        { value: 'contract', label: 'Contract / Labour' },
                                        { value: 'probation', label: 'Probation' },
                                        { value: 'intern', label: 'Intern' },
                                        { value: 'part_time', label: 'Part-time' },
                                    ]}
                                    value={form.employmentType} onChange={(e) => update('employmentType', e.target.value)} />
                                <Input label="Date of Joining" required type="date" value={form.dateOfJoining}
                                    onChange={(e) => update('dateOfJoining', e.target.value)} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                <Input label="Work Location" value={form.workLocation}
                                    onChange={(e) => update('workLocation', e.target.value)} />
                                <Select label="Work Shift" placeholder="Select..." options={shiftOptions}
                                    value={form.workShift} onChange={(e) => update('workShift', e.target.value)} />
                                <Select label="Status"
                                    options={[
                                        { value: 'active', label: 'Active' },
                                        { value: 'probation', label: 'Probation' },
                                        { value: 'on_leave', label: 'On Leave' },
                                        { value: 'suspended', label: 'Suspended' },
                                        { value: 'terminated', label: 'Terminated' },
                                    ]}
                                    value={form.status} onChange={(e) => update('status', e.target.value)} />
                            </div>
                        </>
                    )}

                    {tab === 'user_login' && (
                        <div className="space-y-4">
                            {isEdit && existingData?.data?.userId ? (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-3">
                                    <div className="flex items-center gap-2 text-emerald-900">
                                        <ShieldCheck size={20} className="text-emerald-600 flex-shrink-0" />
                                        <h4 className="font-bold text-sm">System Login Linked (ලොගින් ගිණුම සක්‍රීයයි)</h4>
                                    </div>
                                    <p className="text-xs text-emerald-800">
                                        This employee is linked to an active system user login account.
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-emerald-200/60 text-xs">
                                        <div>
                                            <span className="text-emerald-700 font-medium block">Login Email:</span>
                                            <span className="font-bold text-emerald-950">{existingData.data.userId.email}</span>
                                        </div>
                                        <div>
                                            <span className="text-emerald-700 font-medium block">User Role:</span>
                                            <span className="font-bold text-emerald-950 capitalize font-mono">{existingData.data.userId.role}</span>
                                        </div>
                                        <div>
                                            <span className="text-emerald-700 font-medium block">Account Status:</span>
                                            <span className="font-bold text-emerald-950">{existingData.data.userId.isActive ? 'Active (සක්‍රීයයි)' : 'Inactive'}</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900">
                                        🔐 <strong>System User Account (ලොගින් ගිණුම):</strong> සේවකයාට System එකට සහ Employee Portal එකට Login වීම සඳහා පරිශීලක ගිණුමක් සෑදීමට මෙතැනින් එකඟ වන්න.
                                    </div>

                                    <div className="border rounded-xl p-5 bg-gray-50/50 space-y-4">
                                        <label className="flex items-center gap-3 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 cursor-pointer"
                                                checked={form.createLogin}
                                                onChange={(e) => update('createLogin', e.target.checked)}
                                            />
                                            <div>
                                                <span className="font-bold text-sm text-gray-900 block">
                                                    Create System User Login for this Employee (මෙම සේවකයාට System Login එකක් සාදන්න)
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                    Check this to create credentials so the employee can login to the Employee Portal.
                                                </span>
                                            </div>
                                        </label>

                                        {form.createLogin && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-3 border-t border-gray-200">
                                                <Input
                                                    label="Login Email Address (ලොගින් ඉමේල් ලිපිනය)"
                                                    type="email"
                                                    required
                                                    placeholder={form.email || "employee@company.com"}
                                                    value={form.loginEmail || form.email}
                                                    onChange={(e) => update('loginEmail', e.target.value)}
                                                />
                                                <Input
                                                    label="Login Password (ලොගින් මුරපදය)"
                                                    type="password"
                                                    required
                                                    placeholder="Set password (min 6 chars)"
                                                    value={form.loginPassword}
                                                    onChange={(e) => update('loginPassword', e.target.value)}
                                                />
                                                <Select
                                                    label="System User Role (ලොගින් පදවිය/Role)"
                                                    required
                                                    options={[
                                                        { value: 'employee', label: 'Employee (සේවක Portal අනුමතිය)' },
                                                        { value: 'staff', label: 'Staff (සාමාන්‍ය පරිශීලක)' },
                                                        { value: 'hr_manager', label: 'HR Manager' },
                                                        { value: 'accountant', label: 'Accountant' },
                                                        { value: 'admin', label: 'Administrator' },
                                                    ]}
                                                    value={form.loginRole}
                                                    onChange={(e) => update('loginRole', e.target.value)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'documents' && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs sm:text-sm text-blue-900">
                                📄 <strong>අවශ්‍ය ලේඛන (Required Documents):</strong> Grama Niladhari Certificate, Education Certificates, සහ Police Report වල තත්ත්වය සහ විස්තර ඇතුළත් කරන්න.
                            </div>

                            {/* Grama Niladhari Certificate */}
                            <div className="border rounded-lg p-4 bg-gray-50/50 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                        <FileText size={18} className="text-primary-600" />
                                        1. Grama Niladhari Certificate (GS Certificate / ග්‍රාම නිලධාරී සහතිකය)
                                    </h4>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    <Select label="Status"
                                        options={[
                                            { value: 'pending', label: 'Pending (තවම ලබාදී නැත)' },
                                            { value: 'submitted', label: 'Submitted (ලබාදී ඇත)' },
                                            { value: 'verified', label: 'Verified (තහවුරු කර ඇත)' },
                                            { value: 'rejected', label: 'Rejected (ප්‍රතික්ෂේපිතයි)' },
                                        ]}
                                        value={form.gsCertificate.status}
                                        onChange={(e) => update('gsCertificate.status', e.target.value)} />
                                    <Input label="Certificate No" value={form.gsCertificate.certificateNo}
                                        onChange={(e) => update('gsCertificate.certificateNo', e.target.value)} />
                                    <Input label="Issue Date" type="date" value={form.gsCertificate.issueDate}
                                        onChange={(e) => update('gsCertificate.issueDate', e.target.value)} />
                                    <Input label="Document URL / Link" placeholder="https://..." value={form.gsCertificate.url}
                                        onChange={(e) => update('gsCertificate.url', e.target.value)} />
                                </div>
                            </div>

                            {/* Education Certificates */}
                            <div className="border rounded-lg p-4 bg-gray-50/50 space-y-3">
                                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                    <FileText size={18} className="text-indigo-600" />
                                    2. Education Certificates (අධ්‍යාපන සහතික)
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <Select label="Status"
                                        options={[
                                            { value: 'pending', label: 'Pending (තවම ලබාදී නැත)' },
                                            { value: 'submitted', label: 'Submitted (ලබාදී ඇත)' },
                                            { value: 'verified', label: 'Verified (තහවුරු කර ඇත)' },
                                        ]}
                                        value={form.educationCertificates.status}
                                        onChange={(e) => update('educationCertificates.status', e.target.value)} />
                                    <Input label="Qualifications Summary" placeholder="O/L, A/L, NVQ, Diploma" value={form.educationCertificates.summary}
                                        onChange={(e) => update('educationCertificates.summary', e.target.value)} />
                                    <Input label="Document URL / Link" placeholder="https://..." value={form.educationCertificates.url}
                                        onChange={(e) => update('educationCertificates.url', e.target.value)} />
                                </div>
                            </div>

                            {/* Police Report */}
                            <div className="border rounded-lg p-4 bg-gray-50/50 space-y-3">
                                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                    <FileText size={18} className="text-rose-600" />
                                    3. Police Report (පොලිස් වාර්තාව)
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    <Select label="Status"
                                        options={[
                                            { value: 'pending', label: 'Pending (තවම ලබාදී නැත)' },
                                            { value: 'submitted', label: 'Submitted (ලබාදී ඇත)' },
                                            { value: 'verified', label: 'Verified (තහවුරු කර ඇත)' },
                                            { value: 'expired', label: 'Expired (කල් ඉකුත් වී ඇත)' },
                                        ]}
                                        value={form.policeReport.status}
                                        onChange={(e) => update('policeReport.status', e.target.value)} />
                                    <Input label="Report Reference No" value={form.policeReport.reportNo}
                                        onChange={(e) => update('policeReport.reportNo', e.target.value)} />
                                    <Input label="Issue Date" type="date" value={form.policeReport.issueDate}
                                        onChange={(e) => update('policeReport.issueDate', e.target.value)} />
                                    <Input label="Expiry Date" type="date" value={form.policeReport.expiryDate}
                                        onChange={(e) => update('policeReport.expiryDate', e.target.value)} />
                                </div>
                                <Input label="Document URL / Link" placeholder="https://..." value={form.policeReport.url}
                                    onChange={(e) => update('policeReport.url', e.target.value)} />
                            </div>
                        </div>
                    )}

                    {tab === 'statutory' && (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                <Input label="EPF Number" value={form.epfNumber} onChange={(e) => update('epfNumber', e.target.value)} />
                                <Input label="ETF Number" value={form.etfNumber} onChange={(e) => update('etfNumber', e.target.value)} />
                                <Input label="Tax Registration (TIN)" value={form.taxRegistrationNumber}
                                    onChange={(e) => update('taxRegistrationNumber', e.target.value)} />
                            </div>
                            <p className="text-sm font-semibold mt-4 mb-2">Bank Details (for salary disbursement)</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <Input label="Bank Name" value={form.bankDetails.bankName}
                                    onChange={(e) => update('bankDetails.bankName', e.target.value)} />
                                <Input label="Branch Name" value={form.bankDetails.branchName}
                                    onChange={(e) => update('bankDetails.branchName', e.target.value)} />
                                <Input label="Account Number" value={form.bankDetails.accountNumber}
                                    onChange={(e) => update('bankDetails.accountNumber', e.target.value)} />
                                <Input label="Account Name" value={form.bankDetails.accountName}
                                    onChange={(e) => update('bankDetails.accountName', e.target.value)} />
                            </div>
                        </>
                    )}

                    {tab === 'compensation' && (
                        <>
                            <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-xs sm:text-sm text-emerald-900 mb-2">
                                💰 <strong>Labour Rate (ගෙවීම් ක්‍රමය):</strong> පැයකට (Per Hour) හෝ දිනකට (Per Day) හෝ මාසිකව ගෙවන ගාස්තු සටහන් කිරීම.
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <Select label="Labour Payment Type (ගෙවීම් ක්‍රමය)" required
                                    options={[
                                        { value: 'monthly', label: 'Monthly (මාසික වැටුප්)' },
                                        { value: 'per_day', label: 'Per Day (දිනකට ගෙවන ගාස්තුව)' },
                                        { value: 'per_hour', label: 'Per Hour (පැයකට ගෙවන ගාස්තුව)' },
                                    ]}
                                    value={form.paymentType} onChange={(e) => update('paymentType', e.target.value)} />
                                <Input label="Labour Rate Amount (LKR per hour/day)" type="number" step="0.01" min="0"
                                    value={form.labourRate} onChange={(e) => update('labourRate', Number(e.target.value))} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <Select label="Employee Category" required
                                    options={[
                                        { value: 'Permanent', label: 'Permanent' },
                                        { value: 'Trainee', label: 'Trainee' }
                                    ]}
                                    value={form.employeeCategory} onChange={(e) => update('employeeCategory', e.target.value)} />
                                <Input label="Monthly Basic Salary (LKR/month)" type="number" step="0.01" min="0"
                                    value={form.basicSalary} onChange={(e) => update('basicSalary', e.target.value)} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                <Input label="EPF Rate (%)" type="number" min="0" max="100"
                                    value={form.epfRate} onChange={(e) => update('epfRate', Number(e.target.value))} />
                                <Input label="ETF Rate (%)" type="number" min="0" max="100"
                                    value={form.etfRate} onChange={(e) => update('etfRate', Number(e.target.value))} />
                                <Input label="Automated OT Cutoff (Hours/month)" type="number" min="0"
                                    value={form.otCutoffHours} onChange={(e) => update('otCutoffHours', Number(e.target.value))} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <Select label="Salary Structure" placeholder="None (use basic only)" options={structureOptions}
                                    value={form.salaryStructureId} onChange={(e) => update('salaryStructureId', e.target.value)} />
                                <Select label="Leave Structure" placeholder="None (use default standard balances)" options={leaveStructureOptions}
                                    value={form.leaveStructureId} onChange={(e) => update('leaveStructureId', e.target.value)} />
                            </div>
                            <Textarea label="Notes" rows={3} value={form.notes} onChange={(e) => update('notes', e.target.value)} />
                        </>
                    )}
                </div>

                <div className="flex flex-wrap justify-end gap-2 sm:gap-3 px-3 sm:px-6 py-4 border-t bg-gray-50">
                    <Button variant="outline" onClick={() => navigate('/employees')}>Cancel</Button>
                    <Button variant="primary" onClick={submit}
                        loading={createMutation.isPending || updateMutation.isPending}>
                        <Save size={16} className="mr-1.5" /> {isEdit ? 'Update Details' : 'Save Employee'}
                    </Button>
                </div>
            </Card>
        </div>
    );
}