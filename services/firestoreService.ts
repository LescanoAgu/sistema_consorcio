import { 
    collection, 
    getDocs, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    query, 
    orderBy, 
    setDoc,
    getDoc,
    writeBatch,
    where // <--- IMPORTANTE
} from 'firebase/firestore';
import { 
    getStorage, 
    ref, 
    uploadBytes, 
    getDownloadURL 
} from 'firebase/storage'; 
import { db } from '../src/config/firebase'; 
import { Unit, Expense, Payment, SettlementRecord, Consortium, ConsortiumSettings, Announcement, DebtAdjustment, MaintenanceRequest, Amenity, Booking } from '../types';

// ... (Todo el código anterior igual hasta MAINTENANCE) ...

// --- RECLAMOS (MANTENIMIENTO) ---
export const getMaintenanceRequests = async (consortiumId: string) => {
    const q = query(collection(db, `consortiums/${consortiumId}/maintenance`), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MaintenanceRequest));
};

export const addMaintenanceRequest = async (consortiumId: string, data: Omit<MaintenanceRequest, 'id'>) => {
    const docRef = await addDoc(collection(db, `consortiums/${consortiumId}/maintenance`), data);
    return { id: docRef.id, ...data };
};

export const updateMaintenanceRequest = async (consortiumId: string, id: string, updates: Partial<MaintenanceRequest>) => {
    const docRef = doc(db, `consortiums/${consortiumId}/maintenance`, id);
    await updateDoc(docRef, updates);
};

export const deleteMaintenanceRequest = async (consortiumId: string, id: string) => {
    await deleteDoc(doc(db, `consortiums/${consortiumId}/maintenance`, id));
};

// --- AMENITIES (ESPACIOS COMUNES) --- NUEVO ---
export const getAmenities = async (consortiumId: string) => {
    const q = query(collection(db, `consortiums/${consortiumId}/amenities`));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Amenity));
};

export const addAmenity = async (consortiumId: string, data: Omit<Amenity, 'id'>) => {
    const docRef = await addDoc(collection(db, `consortiums/${consortiumId}/amenities`), data);
    return { id: docRef.id, ...data };
};

export const deleteAmenity = async (consortiumId: string, id: string) => {
    await deleteDoc(doc(db, `consortiums/${consortiumId}/amenities`, id));
};

// --- BOOKINGS (RESERVAS) --- NUEVO ---
export const getBookings = async (consortiumId: string) => {
    const q = query(collection(db, `consortiums/${consortiumId}/bookings`), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Booking));
};

export const addBooking = async (consortiumId: string, data: Omit<Booking, 'id'>) => {
    // Validación básica de no duplicados (simple)
    const q = query(
        collection(db, `consortiums/${consortiumId}/bookings`), 
        where('amenityId', '==', data.amenityId),
        where('date', '==', data.date),
        where('timeSlot', '==', data.timeSlot),
        where('status', '==', 'CONFIRMED')
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
        throw new Error("El turno ya está reservado.");
    }

    const docRef = await addDoc(collection(db, `consortiums/${consortiumId}/bookings`), data);
    return { id: docRef.id, ...data };
};

export const deleteBooking = async (consortiumId: string, id: string) => {
    await deleteDoc(doc(db, `consortiums/${consortiumId}/bookings`, id));
};

// --- EXTRAS QUE YA TENÍAS (Copiar resto igual) ---
// Utilidades, Consortium, Units, Expenses, History, Payments, Settings...
// Asegúrate de que clearCollection y demás funciones base sigan ahí.
// Si copiaste el archivo entero en el paso anterior, solo agrega la parte de Amenities y Bookings.
// Para facilitar, aquí tienes las funciones base necesarias si te faltaban:

export const clearCollection = async (consortiumId: string, collectionName: string) => {
    const q = query(collection(db, `consortiums/${consortiumId}/${collectionName}`));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => { batch.delete(doc.ref); });
    await batch.commit();
};

export const createConsortium = async (data: Omit<Consortium, 'id'>) => {
    const docRef = await addDoc(collection(db, 'consortiums'), data);
    return { id: docRef.id, ...data };
};

export const getConsortiums = async () => {
    const q = query(collection(db, 'consortiums'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Consortium));
};

export const getUnits = async (consortiumId: string) => {
    const q = query(collection(db, `consortiums/${consortiumId}/units`), orderBy('unitNumber'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Unit));
};

export const addUnit = async (consortiumId: string, unit: Omit<Unit, 'id'>) => {
    const docRef = await addDoc(collection(db, `consortiums/${consortiumId}/units`), unit);
    return { id: docRef.id, ...unit };
};

export const updateUnit = async (consortiumId: string, unit: Unit) => {
    const docRef = doc(db, `consortiums/${consortiumId}/units`, unit.id);
    await updateDoc(docRef, { ...unit });
};

export const deleteUnit = async (consortiumId: string, unitId: string) => {
    const docRef = doc(db, `consortiums/${consortiumId}/units`, unitId);
    await deleteDoc(docRef);
};

export const getExpenses = async (consortiumId: string) => {
    const q = query(collection(db, `consortiums/${consortiumId}/expenses`), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Expense));
};

export const addExpense = async (consortiumId: string, expense: Omit<Expense, 'id'>) => {
    const docRef = await addDoc(collection(db, `consortiums/${consortiumId}/expenses`), expense);
    return { id: docRef.id, ...expense };
};

export const updateExpense = async (consortiumId: string, expenseId: string, updates: Partial<Expense>) => {
    const docRef = doc(db, `consortiums/${consortiumId}/expenses`, expenseId);
    await updateDoc(docRef, updates);
};

export const deleteExpense = async (consortiumId: string, expenseId: string) => {
    await deleteDoc(doc(db, `consortiums/${consortiumId}/expenses`, expenseId));
};

export const uploadExpenseReceipt = async (file: File): Promise<string> => {
    const storage = getStorage();
    const storageRef = ref(storage, `expenses/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
};

export const getAnnouncements = async (consortiumId: string) => {
    const q = query(collection(db, `consortiums/${consortiumId}/announcements`), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Announcement));
};

export const addAnnouncement = async (consortiumId: string, data: Omit<Announcement, 'id'>) => {
    const docRef = await addDoc(collection(db, `consortiums/${consortiumId}/announcements`), data);
    return { id: docRef.id, ...data };
};

export const deleteAnnouncement = async (consortiumId: string, id: string) => {
    await deleteDoc(doc(db, `consortiums/${consortiumId}/announcements`, id));
};

export const getDebtAdjustments = async (consortiumId: string) => {
    const q = query(collection(db, `consortiums/${consortiumId}/debt_adjustments`), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DebtAdjustment));
};

export const addDebtAdjustment = async (consortiumId: string, data: Omit<DebtAdjustment, 'id'>) => {
    const docRef = await addDoc(collection(db, `consortiums/${consortiumId}/debt_adjustments`), data);
    return { id: docRef.id, ...data };
};

export const deleteDebtAdjustment = async (consortiumId: string, id: string) => {
    await deleteDoc(doc(db, `consortiums/${consortiumId}/debt_adjustments`, id));
};

export const saveSettlement = async (consortiumId: string, record: SettlementRecord, expenseIdsToRemove: string[]) => {
    await addDoc(collection(db, `consortiums/${consortiumId}/history`), record);
    for (const id of expenseIdsToRemove) {
        await deleteDoc(doc(db, `consortiums/${consortiumId}/expenses`, id));
    }
    await saveSettings(consortiumId, { 
        reserveFundBalance: record.reserveBalanceAtClose,
    } as any); 
};

export const getHistory = async (consortiumId: string) => {
    const q = query(collection(db, `consortiums/${consortiumId}/history`), orderBy('month', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SettlementRecord));
};

export const uploadPaymentReceipt = async (file: File): Promise<string> => {
    const storage = getStorage();
    const storageRef = ref(storage, `receipts/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
};

export const createPayment = async (consortiumId: string, payment: Omit<Payment, 'id'>) => {
    const docRef = await addDoc(collection(db, `consortiums/${consortiumId}/payments`), payment);
    return { id: docRef.id, ...payment };
};

export const updatePayment = async (consortiumId: string, paymentId: string, updates: Partial<Payment>) => {
    const docRef = doc(db, `consortiums/${consortiumId}/payments`, paymentId);
    await updateDoc(docRef, updates);
};

export const getPayments = async (consortiumId: string) => {
    const q = query(collection(db, `consortiums/${consortiumId}/payments`), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Payment));
};

export const getSettings = async (consortiumId: string): Promise<ConsortiumSettings> => {
    const docRef = doc(db, `consortiums/${consortiumId}/settings`, 'general');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
        return snap.data() as ConsortiumSettings;
    } else {
        return { 
            reserveFundBalance: 0, 
            monthlyReserveContributionPercentage: 5,
            bankName: '', bankCBU: '', bankAlias: '', bankHolder: '', bankCuit: ''
        };
    }
};

export const saveSettings = async (consortiumId: string, settings: ConsortiumSettings) => {
    const docRef = doc(db, `consortiums/${consortiumId}/settings`, 'general');
    await setDoc(docRef, settings, { merge: true });
};