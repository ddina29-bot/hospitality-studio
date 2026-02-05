
export type UserRole = 
  | 'cleaner' 
  | 'driver' 
  | 'supervisor' 
  | 'admin' 
  | 'housekeeping' 
  | 'maintenance' 
  | 'client'
  | 'hr'
  | 'finance'
  | 'laundry'
  | 'outsourced_maintenance';

export type TabType = 
  | 'dashboard'
  | 'shifts' 
  | 'logistics'
  | 'laundry'
  | 'properties'
  | 'clients'
  | 'finance'
  | 'reports'
  | 'users'
  | 'settings'
  | 'inventory_admin'
  | 'tutorials';

export interface Message {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
}

export interface AttributedPhoto {
  url: string;
  userId: string;
}

export interface CleaningTask {
  id: string;
  label: string;
  isMandatory: boolean;
  minPhotos: number;
  photos: AttributedPhoto[];
}

export interface SpecialReport {
  id: string;
  description: string;
  photos: string[];
  timestamp: number;
  status: 'open' | 'resolved' | 'assigned' | 'pending';
  category?: 'laundry' | 'apartment';
  assignedTo?: string;
  assignedToName?: string;
  assignedAt?: number;
  assignmentNotes?: string;
  cost?: number;
  invoiceRef?: string;
  vendorNotes?: string;
}

export interface AnomalyReport {
  id: string;
  userId: string;
  userName: string;
  type: 'high_usage' | 'hygiene_risk';
  message: string;
  timestamp: number;
  status: 'filed' | 'investigating' | 'resolved';
}

export interface SupplyItem {
  id: string;
  name: string;
  unit: string;
  category: 'spray' | 'basic' | 'linen' | 'pack';
  explanation: string;
  photo: string;
  type: 'cleaning' | 'laundry' | 'welcome pack' | 'other';
}

export interface ManualTask {
  id: string;
  propertyId: string;
  propertyName: string;
  taskName: string;
  userId: string;
  userName: string;
  date: string;
  status: 'pending' | 'completed';
  isBillable?: boolean;
  billablePrice?: number;
}

export interface SupplyRequest {
  id: string;
  itemId: string;
  itemName: string;
  quantity: number;
  userId: string;
  userName: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface TimeEntry {
  id: string;
  userId: string;
  type: 'in' | 'out';
  timestamp: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: 'Company' | 'Safety' | 'Procedure' | 'Social';
  author: string;
  date: string;
  timestamp: number;
}

export interface InvoiceItem {
  description: string;
  date: string;
  amount: number;
}

export interface OrganizationSettings {
  id: string;
  name: string;
  address: string;
  email: string;
  phone: string;
  website?: string;
  legalEntity?: string;
  taxId?: string;
  peNumber?: string;
  regNumber?: string;
}

export type LeaveType = 'Day Off' | 'Sick Leave' | 'Vacation Leave';

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface AuditReport {
  id: string;
  shiftId: string;
  inspectorId: string;
  status: 'passed' | 'failed';
  notes: string;
  timestamp: number;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'alert' | 'success' | 'warning';
  timestamp: number;
  linkTab?: TabType;
  linkId?: string;
}

export interface Tutorial {
  id: string;
  title: string;
  category: 'setup' | 'cleaning' | 'safety' | string;
  description: string;
  videoUrl: string;
  thumbnail: string;
}

export interface MaintenanceTicket {
  id: string;
  propertyName: string;
  description: string;
  status: 'pending' | 'in-progress' | 'resolved';
  timestamp: number;
}

export interface Property {
  id: string;
  name: string;
  type: 'Villa' | 'Penthouse' | 'Studio' | 'Apartment' | 'Townhouse';
  clientId: string;
  address: string;
  lat?: number;
  lng?: number;
  apartmentNumber?: string;
  floorNumber?: string;
  entrancePhoto: string;
  keyboxPhoto?: string;
  kitchenPhoto?: string;
  livingRoomPhoto?: string;
  welcomePackPhoto?: string;
  roomPhotos?: string[];
  bathroomPhotos?: string[];
  keyboxCode: string;
  mainEntranceCode?: string;
  accessNotes: string;
  rooms: number;
  bathrooms: number;
  halfBaths: number;
  doubleBeds: number;
  singleBeds: number;
  sofaBeds: number;
  sofaBed?: 'none' | 'single' | 'double';
  foldableBeds?: number;
  babyCots?: number;
  pillows: number;
  hasBabyCot?: boolean;
  capacity: number;
  hasDishwasher: boolean;
  hasCoffeeMachine: boolean;
  coffeeMachineType?: string;
  clientPrice: number;
  clientPriceType?: 'Fixed' | 'Per Hour';
  clientRefreshPrice?: number;
  clientMidStayPrice?: number;
  clientServiceRates?: Record<string, number>;
  cleanerPrice: number;
  cleanerRefreshPrice?: number;
  cleanerMidStayPrice?: number;
  cleanerAuditPrice?: number;
  cleanerCommonAreaPrice?: number;
  cleanerBedsOnlyPrice?: number;
  serviceRates?: Record<string, number>;
  status: 'active' | 'disabled';
  specialRequests: string[];
  packType?: string;
  packNotes?: string;
}

export type EmploymentType = 'Full-Time' | 'Part-Time' | 'Casual' | 'Contractor';
export type PaymentType = 'Per Clean' | 'Per Hour' | 'Fixed Wage';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  phone?: string;
  status: 'active' | 'inactive' | 'pending';
  hasID?: boolean;
  hasContract?: boolean;
  contractFileUrl?: string;
  idFileUrl?: string;
  payRate?: number;
  paymentType?: PaymentType;
  maritalStatus?: string;
  isParent?: boolean;
  childrenCount?: number;
  photoUrl?: string;
  idPassportNumber?: string;
  niNumber?: string;
  iban?: string;
  password?: string;
  activationToken?: string;
  employmentType?: EmploymentType;
  activationDate?: string;
  homeAddress?: string;
  dateOfBirth?: string;
  lastSupplyRequestDate?: number;
}

export interface Shift {
  id: string;
  propertyId: string;
  propertyName: string;
  userIds: string[];
  date: string;
  startTime: string;
  endTime?: string;
  serviceType: string;
  status: 'pending' | 'active' | 'completed';
  approvalStatus: 'pending' | 'approved' | 'rejected';
  isPublished: boolean;
  actualStartTime?: number;
  actualEndTime?: number;
  tasks?: CleaningTask[];
  wasRejected?: boolean;
  approvalComment?: string;
  checkoutPhotos?: {
    keyInBox: AttributedPhoto[];
    boxClosed: AttributedPhoto[];
  };
  correctionStatus?: 'none' | 'fixing' | 'pending';
  excludeLaundry?: boolean;
  isDelivered?: boolean;
  isCollected?: boolean;
  isCleanLinenTakenFromOffice?: boolean;
  keysHandled?: boolean;
  keysAtOffice?: boolean;
  keyLocationReason?: string;
  replacedUserId?: string;
  notes?: string;
  decidedBy?: string;
  paid?: boolean;
  payoutDate?: string;
  fixWorkPayment?: number;
  isLaundryPrepared?: boolean;
  isLaundryPickedUp?: boolean;
  isLinenShortage?: boolean;
  originalCleaningPhotos?: string[];
  maintenanceReports?: SpecialReport[];
  damageReports?: SpecialReport[];
  missingReports?: SpecialReport[];
  messReport?: {
    description: string;
    photos: string[];
    status: 'pending' | 'approved' | 'rejected';
    decisionNote?: string;
  };
  inspectionPhotos?: string[];
}

export interface Client {
  id: string;
  name: string;
  contactEmail: string;
  phone: string;
  billingAddress: string;
  status: 'active' | 'inactive';
  vatNumber?: string;
  propertyIds?: string[];
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  issueDate: string;
  totalAmount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  dueDate: string;
  periodStart?: string;
  periodEnd?: string;
  items: InvoiceItem[];
  subtotal?: number;
  discount?: number;
  vat?: number;
}
