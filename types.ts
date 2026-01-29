
export type UserRole = 
  | 'cleaner' 
  | 'driver' 
  | 'supervisor' 
  | 'admin' 
  | 'housekeeping' 
  | 'maintenance' 
  | 'outsourced_maintenance' 
  | 'client'
  | 'hr'
  | 'finance'
  | 'laundry';

export interface OrganizationSettings {
  name: string;
  legalEntity: string;
  regNumber?: string;
  taxId: string;
  peNumber?: string;
  address: string;
  email: string;
  phone: string;
  website: string;
}

export interface ManualTask {
  id: string;
  propertyId: string;
  propertyName: string;
  taskName: string;
  userId: string;
  userName: string;
  date: string; // ISO string
  status: 'pending' | 'completed';
  isBillable?: boolean;
  billablePrice?: number;
}

export interface AttributedPhoto {
  url: string;
  userId: string;
}

export interface TimeEntry {
  id: string;
  type: 'in' | 'out';
  timestamp: Date;
}

export type PropertyType = 'Villa' | 'Townhouse' | 'Penthouse' | 'Studio' | 'Apartment';
export type SofaBedType = 'none' | 'single' | 'double';
export type EmploymentType = 'Full-Time' | 'Part-Time' | 'Casual' | 'Contractor';
export type PaymentType = 'Per Clean' | 'Per Hour' | 'Fixed Wage' | 'Contract Fixed';
export type SupplyCategory = 'laundry' | 'cleaning' | 'maintenance' | 'welcome pack' | 'other';
export type LeaveType = 'Day Off' | 'Sick Leave' | 'Vacation Leave';

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  type: LeaveType;
  startDate: string; // ISO String
  endDate: string;   // ISO String
  status: 'pending' | 'approved' | 'rejected';
}

export interface Tutorial {
  id: string;
  title: string;
  category: 'cleaning' | 'setup' | 'safety';
  videoUrl?: string;
  description: string;
  thumbnail: string;
}

export interface Property {
  id: string;
  name: string;
  type: PropertyType;
  clientId: string;
  address: string;
  apartmentNumber?: string;
  floor?: string;
  entrancePhoto: string;
  keyboxPhoto?: string;
  keyboxCode: string;
  mainEntranceCode?: string;
  accessNotes: string;
  lat?: number;
  lng?: number;
  rooms: number;
  bathrooms: number;
  halfBaths: number;
  hasDishwasher: boolean;
  hasCoffeeMachine: boolean;
  coffeeMachineType?: string;
  doubleBeds: number;
  singleBeds: number;
  pillows: number;
  sofaBed: SofaBedType;
  foldableBeds: number;
  babyCots: number;
  capacity: number;
  clientPrice: number;
  clientPriceType?: 'Fixed' | 'Per Hour'; // Deprecated but kept for type compatibility
  clientServiceRates?: Record<string, number>; // Specific client rates (e.g., REFRESH, MID STAY)
  cleanerPrice: number;
  servicePackage?: string;
  packagePrice?: number;
  packageNote?: string;
  serviceRates?: Record<string, number>; // Cleaner rates
  specialRequests: string[];
  roomReferencePhotos: Record<string, string[]>;
  status?: 'active' | 'disabled';
}

export interface Client {
  id: string;
  name: string;
  contactEmail: string;
  phone: string;
  billingAddress?: string;
  vatNumber?: string;
  propertyIds: string[];
  status: 'active' | 'inactive';
}

export interface InvoiceItem {
  description: string;
  date: string;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  issueDate: string;
  dueDate: string;
  periodStart?: string;
  periodEnd?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  vat: number;
  totalAmount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
}

export type TabType = 
  | 'dashboard' 
  | 'laundry'
  | 'shifts' 
  | 'logistics'
  | 'supervisor_portal'
  | 'properties'
  | 'clients'
  | 'tutorials'
  | 'inventory_admin'
  | 'maintenance'
  | 'reports'
  | 'finance'
  | 'personnel_profile'
  | 'users'
  | 'settings'
  | 'ai'
  | 'manual';

export interface SupplyItem {
  id: string;
  name: string;
  photo: string;
  category: 'spray' | 'basic' | 'linen' | 'pack';
  type: SupplyCategory;
  explanation: string; // How to use instructions
  unit: string;
}

export interface SupplyRequest {
  id: string;
  userId: string;
  userName: string;
  itemId: string;
  itemName: string;
  quantity: number;
  date: string; // ISO string
  status: 'pending' | 'approved' | 'delivered';
}

export interface SpecialReport {
  id: string;
  description: string;
  photos: string[];
  timestamp: number;
  status?: 'open' | 'assigned' | 'resolved';
  assignedTo?: string;
  assignedToName?: string;
  assignedAt?: number;
  assignmentNotes?: string;
  category?: 'laundry' | 'apartment';
  // Outsourcing Fields
  cost?: number;
  invoiceRef?: string;
  vendorNotes?: string;
}

export interface AuditReport {
  id: string;
  shiftId: string;
  propertyName: string;
  serviceType: string;
  cleanerNames: string[];
  decision: 'approved' | 'rejected';
  reason: string;
  decidedBy: string;
  timestamp: number;
  photos: string[];
  checkInTime?: number;
  checkOutTime?: number;
  paymentAmount: number;
  paymentType: string;
  maintenanceReports?: SpecialReport[];
  damageReports?: SpecialReport[];
  missingReports?: SpecialReport[];
}

export interface Shift {
  id: string;
  propertyId: string;
  userIds: string[];
  date: string;
  status: 'pending' | 'active' | 'completed';
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  correctionStatus?: 'fixing' | 'corrected';
  approvalComment?: string;
  serviceType: string;
  startTime: string;
  endTime?: string;
  notes?: string;
  propertyName?: string;
  actualStartTime?: number;
  actualEndTime?: number;
  wasRejected?: boolean; 
  fixWorkPayment?: number;
  decidedBy?: string;
  isPublished?: boolean; 
  excludeLaundry?: boolean;
  checkoutPhotos?: {
    keyInBox?: AttributedPhoto[];
    boxClosed?: AttributedPhoto[];
  };
  tasks?: CleaningTask[]; 
  messReport?: {
    description: string;
    photos: string[];
    status: 'pending' | 'approved' | 'rejected';
    extraHoursApproved?: number;
    adminReason?: string;
  };
  maintenanceReports?: SpecialReport[];
  damageReports?: SpecialReport[];
  missingReports?: SpecialReport[];
  // Supervisor Inspection
  inspectionPhotos?: string[];
  // Previous data for remedial
  originalCleaningPhotos?: string[];
  // Logistics fields
  isDelivered?: boolean;
  isCollected?: boolean;
  keysHandled?: boolean; // Keys from Office
  keysAtOffice?: boolean; // Keys returned
  keyLocationReason?: string;
  // Replacement tracking
  replacedUserId?: string;
  // Laundry tracking
  isLaundryPrepared?: boolean;
  isLaundryPickedUp?: boolean;
  // Finance
  paid?: boolean;
  payoutDate?: string;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  phone?: string;
  whatsappNumber?: string;
  address?: string;
  dateOfBirth?: string;
  status: 'pending' | 'active' | 'inactive';
  password?: string;
  idPassportNumber?: string;
  niNumber?: string;
  maritalStatus?: string;
  employmentType?: EmploymentType;
  paymentType?: PaymentType;
  isParent?: boolean;
  payRate?: number;
  iban?: string;
  taxId?: string;
  activationDate?: string;
  // Resource fields
  assignedVehicle?: string;
  vehicleStatus?: 'pending' | 'verified';
  // Compliance Docs
  hasID?: boolean;
  hasContract?: boolean;
  hasPhoto?: boolean;
}

export interface CleaningTask {
  id: string;
  label: string;
  isMandatory: boolean;
  minPhotos: number;
  photos: AttributedPhoto[];
}

export interface Message {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
  isAi?: boolean;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  author: string;
  category: 'Safety' | 'Procedure' | 'Company' | 'Social';
  timestamp: number;
}

export interface MaintenanceTicket {
  id: string;
  propertyId: string;
  propertyName: string;
  type: string;
  description: string;
  status: 'reported' | 'assigned' | 'completed';
  severity: 'low' | 'medium' | 'high';
  assignmentType: 'internal' | 'outsourced';
  assignedUserId?: string;
  vendorName?: string;
  quotedCost?: number;
  timestamp: number;
}