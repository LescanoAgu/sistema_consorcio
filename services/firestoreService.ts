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
    getDoc
} from 'firebase/firestore';
import { 
    getStorage, 
    ref, 
    uploadBytes, 
    getDownloadURL 
} from 'firebase/storage'; 
// CORRECCIÓN: Ruta correcta según tu estructura de carpetas
import { db } from '../src/config/firebase'; 
import { Unit, Expense, Payment, SettlementRecord, Consortium, ConsortiumSettings } from '../types';

// --- CONSORTIUM MANAGEMENT ---
export const createConsortium = async (data: Omit<Consortium, 'id'>) => {
    const docRef = await addDoc(collection(db, 'consortiums'), data);
    return { id: docRef.id, ...data };
};

export const getConsortiums = async () => {
    const q = query(collection(db, 'consortiums'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Consortium));
};

// --- UNITS ---
// Usado por: UnitsView, App, UserPortal

export const getUnits = async (consortiumId: string) => {
    const q = query(collection(db, `consortiums/${consortiumId}/units`), orderBy('unitNumber'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Unit));
};

// IMPORTANTE: Renombrado a 'addUnit' para que UnitsView funcione
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

// --- EXPENSES ---
// Usado por: ExpensesView, SettlementView, App

export const getExpenses = async (consortiumId: string) => {
    const q = query(collection(db, `consortiums/${consortiumId}/expenses`), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Expense));
};

// IMPORTANTE: Renombrado a 'addExpense' para que ExpensesView funcione
export const addExpense = async (consortiumId: string, expense: Omit<Expense, 'id'>) => {
    const docRef = await addDoc(collection(db, `consortiums/${consortiumId}/expenses`), expense);
    return { id: docRef.id, ...expense };
};

// IMPORTANTE: Agregado porque SettlementView lo necesita
export const updateExpense = async (consortiumId: string, expenseId: string, updates: Partial<Expense>) => {
    const docRef = doc(db, `consortiums/${consortiumId}/expenses`, expenseId);
    await updateDoc(docRef, updates);
};

export const deleteExpense = async (consortiumId: string, expenseId: string) => {
    await deleteDoc(doc(db, `consortiums/${consortiumId}/expenses`, expenseId));
};

// --- SETTLEMENTS & HISTORY ---
export const saveSettlement = async (consortiumId: string, record: SettlementRecord, expenseIdsToRemove: string[]) => {
    // 1. Guardar registro en historial
    await addDoc(collection(db, `consortiums/${consortiumId}/history`), record);

    // 2. Archivar/Borrar gastos liquidados
    for (const id of expenseIdsToRemove) {
        await deleteDoc(doc(db, `consortiums/${consortiumId}/expenses`, id));
    }
    
    // 3. Actualizar saldo del fondo en configuración
    await saveSettings(consortiumId, { 
        reserveFundBalance: record.reserveBalanceAtClose,
    } as any); 
};

export const getHistory = async (consortiumId: string) => {
    const q = query(collection(db, `consortiums/${consortiumId}/history`), orderBy('month', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SettlementRecord));
};

// --- PAYMENTS & COLLECTIONS ---
// Usado por: App (handleReportPayment), CollectionsView

export const uploadPaymentReceipt = async (file: File): Promise<string> => {
    const storage = getStorage();
    const storageRef = ref(storage, `receipts/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
};

// App.tsx usa createPayment
export const createPayment = async (consortiumId: string, payment: Omit<Payment, 'id'>) => {
    const docRef = await addDoc(collection(db, `consortiums/${consortiumId}/payments`), payment);
    return { id: docRef.id, ...payment };
};

// IMPORTANTE: Agregado para aprobar/rechazar pagos
export const updatePayment = async (consortiumId: string, paymentId: string, updates: Partial<Payment>) => {
    const docRef = doc(db, `consortiums/${consortiumId}/payments`, paymentId);
    await updateDoc(docRef, updates);
};

export const getPayments = async (consortiumId: string) => {
    const q = query(collection(db, `consortiums/${consortiumId}/payments`), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Payment));
};

// --- SETTINGS ---
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