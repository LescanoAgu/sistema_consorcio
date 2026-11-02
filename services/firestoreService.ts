import { 
    collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, setDoc, getDoc, writeBatch, where, documentId, limit 
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'; 
import { db } from '../src/config/firebase'; 
import { Unit, Expense, Payment, SettlementRecord, Consortium, ConsortiumSettings, Announcement, MaintenanceRequest, Amenity, Booking, ConsortiumDocument, ExpenseTemplate, ReserveTransaction, JoinRequest, DebtItem } from '../types';

export const clearCollection = async (consortiumId: string, collectionName: string) => {
    const q = query(collection(db, `consortiums/${consortiumId}/${collectionName}`));
    const snapshot = await getDocs(q);
    
    // Chunk deletions into groups of 400 to avoid Firestore limits
    for (let i = 0; i < snapshot.docs.length; i += 400) {
        const chunk = snapshot.docs.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach((doc) => { batch.delete(doc.ref); });
        await batch.commit();
    }
};

export const createConsortium = async (data: Omit<Consortium, 'id'>, userId: string) => {
    const { id, ...cleanData } = data as any; 
    const consortiumData = { ...cleanData, adminIds: [userId] };
    const docRef = await addDoc(collection(db, 'consortiums'), consortiumData);
    return { ...consortiumData, id: docRef.id };
};

export const getAdminConsortiums = async (userId: string) => {
    const q = query(collection(db, 'consortiums'), where('adminIds', 'array-contains', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Consortium));
};

export const getUserConsortiums = async (email: string) => {
    if (!email) return [];
    const cleanEmail = email.trim().toLowerCase();
    const candidates = Array.from(new Set([cleanEmail, email.trim()]));
    let consortiumIds: string[] = [];

    for (const candidateEmail of candidates) {
        // Leer accesos legacy (documento viejo)
        const accessRef = doc(db, 'user_access', candidateEmail);
        const accessSnap = await getDoc(accessRef);
        if (accessSnap.exists() && accessSnap.data().consortiumIds) {
            accessSnap.data().consortiumIds.forEach((cid: string) => {
                if (!consortiumIds.includes(cid)) consortiumIds.push(cid);
            });
        }
        
        // Leer accesos nuevos (subcolección segura)
        const rolesQuery = query(collection(db, `user_access/${candidateEmail}/consortium_roles`));
        const rolesSnap = await getDocs(rolesQuery);
        rolesSnap.forEach(roleDoc => {
            if (!consortiumIds.includes(roleDoc.id)) {
                consortiumIds.push(roleDoc.id);
            }
        });
    }

    if (consortiumIds.length === 0) return [];
    
    // Chunking the IN query to max 30 elements
    const chunks = [];
    for (let i = 0; i < consortiumIds.length; i += 30) {
        chunks.push(consortiumIds.slice(i, i + 30));
    }
    
    const results: Consortium[] = [];
    for (const chunk of chunks) {
        const q = query(collection(db, 'consortiums'), where(documentId(), 'in', chunk));
        const snapshot = await getDocs(q);
        results.push(...snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Consortium)));
    }
    return results;
};

export const registerUserAccess = async (email: string, consortiumId: string) => {
    if (!email) return;
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;
    // Nueva forma segura usando subcolección donde el ID del documento es el ID del consorcio
    const roleRef = doc(db, `user_access/${cleanEmail}/consortium_roles/${consortiumId}`);
    await setDoc(roleRef, { active: true, addedAt: new Date().toISOString() }, { merge: true });
};

export const getUnits = async (consortiumId: string, userEmail: string | null = null, isAdmin: boolean = true) => {
    const unitsRef = collection(db, `consortiums/${consortiumId}/units`);
    if (isAdmin) {
        const snapshot = await getDocs(query(unitsRef));
        const list = snapshot.docs.map(d => ({ ...(d.data() as any), id: d.id } as Unit));
        return list.sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true, sensitivity: 'base' }));
    } else {
        if (!userEmail) return [];
        const cleanEmail = userEmail.trim().toLowerCase();
        const emailVariants = Array.from(new Set([cleanEmail, userEmail.trim()]));
        const unitMap = new Map<string, Unit>();

        for (const variant of emailVariants) {
            const q = query(unitsRef, where('authorizedEmails', 'array-contains', variant));
            const snapshot = await getDocs(q);
            snapshot.docs.forEach(d => unitMap.set(d.id, { ...(d.data() as any), id: d.id } as Unit));
        }

        const list = Array.from(unitMap.values());
        return list.sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true, sensitivity: 'base' }));
    }
};

export const addUnit = async (consortiumId: string, unit: Omit<Unit, 'id'>) => {
    const docRef = await addDoc(collection(db, `consortiums/${consortiumId}/units`), unit);
    if (unit.authorizedEmails && unit.authorizedEmails.length > 0) {
        for (const email of unit.authorizedEmails) {
            await registerUserAccess(email.trim().toLowerCase(), consortiumId);
        }
    }
    return { id: docRef.id, ...unit };
};

export const updateUnit = async (consortiumId: string, unitId: string, updates: Partial<Unit>, unit?: Unit) => {
    const docRef = doc(db, `consortiums/${consortiumId}/units`, unitId);
    await updateDoc(docRef, { ...updates });
    const emailsToRegister = updates.authorizedEmails || unit?.authorizedEmails || [];
    if (emailsToRegister.length > 0) {
        for (const email of emailsToRegister) {
            if (email && email.trim()) {
                await registerUserAccess(email.trim().toLowerCase(), consortiumId);
            }
        }
    }
};

export const deleteUnit = async (consortiumId: string, unitId: string) => {
    const docRef = doc(db, `consortiums/${consortiumId}/units`, unitId);
    await deleteDoc(docRef);
};

export const getDocuments = async (consortiumId: string) => {
    const q = query(collection(db, `consortiums/${consortiumId}/documents`), orderBy('date', 'desc'), limit(50));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as ConsortiumDocument));
};
export const addDocument = async (consortiumId: string, data: Omit<ConsortiumDocument, 'id'>) => {
    const docRef = await addDoc(collection(db, `consortiums/${consortiumId}/documents`), data);
    return { id: docRef.id, ...data };
};
export const deleteDocument = async (consortiumId: string, id: string) => {
    await deleteDoc(doc(db, `consortiums/${consortiumId}/documents`, id));
};
export const uploadDocumentFile = async (file: File): Promise<string> => {
    const storage = getStorage();
    const storageRef = ref(storage, `documents/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
};

export const getExpenses = async (consortiumId: string) => {
    const q = query(collection(db, `consortiums/${consortiumId}/expenses`), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Expense));
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
    const q = query(collection(db, `consortiums/${consortiumId}/announcements`), orderBy('date', 'desc'), limit(50));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Announcement));
};
export const addAnnouncement = async (consortiumId: string, data: Omit<Announcement, 'id'>) => {
    const docRef = await addDoc(collection(db, `consortiums/${consortiumId}/announcements`), data);
    return { id: docRef.id, ...data };
};
export const deleteAnnouncement = async (consortiumId: string, id: string) => {
    await deleteDoc(doc(db, `consortiums/${consortiumId}/announcements`, id));
};

export const getMaintenanceRequests = async (consortiumId: string, isAdmin: boolean = true, myUnitIds: string[] = []) => {
    const maintenanceRef = collection(db, `consortiums/${consortiumId}/maintenance`);
    if (isAdmin) {
        const q = query(maintenanceRef, orderBy('date', 'desc'), limit(50));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as MaintenanceRequest));
    } else {
        if (myUnitIds.length === 0) return [];
        const chunk = myUnitIds.slice(0, 30);
        const q = query(maintenanceRef, where('unitId', 'in', chunk), limit(50));
        const snapshot = await getDocs(q);
        const results = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as MaintenanceRequest));
        return results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
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

export const getAmenities = async (consortiumId: string) => {
    const q = query(collection(db, `consortiums/${consortiumId}/amenities`));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Amenity));
};
export const addAmenity = async (consortiumId: string, data: Omit<Amenity, 'id'>) => {
    const docRef = await addDoc(collection(db, `consortiums/${consortiumId}/amenities`), data);
    return { id: docRef.id, ...data };
};
export const deleteAmenity = async (consortiumId: string, id: string) => {
    await deleteDoc(doc(db, `consortiums/${consortiumId}/amenities`, id));
};

export const getBookings = async (consortiumId: string) => {
    const q = query(collection(db, `consortiums/${consortiumId}/bookings`), orderBy('date', 'desc'), limit(50));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Booking));
};
export const addBooking = async (consortiumId: string, data: Omit<Booking, 'id'>) => {
    const q = query(collection(db, `consortiums/${consortiumId}/bookings`), where('date', '==', data.date));
    const snapshot = await getDocs(q);
    const alreadyBooked = snapshot.docs.some(d => {
        const b = d.data() as Booking;
        return b.amenityId === data.amenityId && b.timeSlot === data.timeSlot && b.status === 'CONFIRMED';
    });
    if (alreadyBooked) throw new Error("El turno ya está reservado.");
    const docRef = await addDoc(collection(db, `consortiums/${consortiumId}/bookings`), data);
    return { id: docRef.id, ...data };
};
export const deleteBooking = async (consortiumId: string, id: string) => {
    await deleteDoc(doc(db, `consortiums/${consortiumId}/bookings`, id));
};

export const saveSettlement = async (consortiumId: string, record: SettlementRecord, expenseIdsToRemove: string[], units: Unit[]) => {
    const historyRef = collection(db, `consortiums/${consortiumId}/history`);
    const q = query(historyRef, where('month', '==', record.month), limit(1));
    const snapshot = await getDocs(q);

    // Operación principal atómica (historial, deudas/créditos de unidades y borrado de gastos activos)
    const mainBatch = writeBatch(db);
    let mainBatchOpsCount = 0;

    if (!snapshot.empty) {
        const existingDoc = snapshot.docs[0];
        mainBatch.update(doc(db, `consortiums/${consortiumId}/history`, existingDoc.id), record as any);
    } else {
        const newHistoryRef = doc(historyRef);
        mainBatch.set(newHistoryRef, record);
    }
    mainBatchOpsCount++;

    // Actualizar deudas y saldos a favor de las unidades
    if (record.unitDetails && units.length > 0) {
        record.unitDetails.forEach(detail => {
            const unit = units.find(u => u.id === detail.unitId);
            if (!unit) return;

            const creditApplied = Number(detail.creditApplied || 0);
            const currentCredit = Number(unit.creditBalance || 0);
            const newCreditBalance = Number(Math.max(0, currentCredit - creditApplied).toFixed(2));

            const currentDebts: DebtItem[] = [...(unit.debts || [])];
            const existingIndex = currentDebts.findIndex(d => d.period === record.month);

            if (detail.totalToPay > 0) {
                const newDebtItem: DebtItem = {
                    id: existingIndex >= 0 ? currentDebts[existingIndex].id : `debt_${record.month.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`,
                    period: record.month,
                    baseAmount: detail.totalToPay,
                    ordinaryAmount: detail.ordinaryAmount !== undefined ? detail.ordinaryAmount : detail.totalToPay,
                    extraordinaryAmount: detail.extraordinaryAmount || 0,
                    reserveAmount: detail.reserveAmount || 0,
                    interestRate: existingIndex >= 0 ? currentDebts[existingIndex].interestRate : 0,
                    interestAmount: existingIndex >= 0 ? currentDebts[existingIndex].interestAmount : 0,
                    total: Number((detail.totalToPay + (existingIndex >= 0 ? currentDebts[existingIndex].interestAmount : 0)).toFixed(2)),
                    createdAt: existingIndex >= 0 ? currentDebts[existingIndex].createdAt : new Date().toISOString(),
                    interestLogs: existingIndex >= 0 ? (currentDebts[existingIndex].interestLogs || []) : []
                };

                if (existingIndex >= 0) {
                    currentDebts[existingIndex] = newDebtItem;
                } else {
                    currentDebts.push(newDebtItem);
                }
            }

            if (detail.totalToPay > 0 || creditApplied > 0) {
                mainBatch.update(doc(db, `consortiums/${consortiumId}/units`, unit.id), {
                    debts: currentDebts,
                    creditBalance: newCreditBalance
                });
                mainBatchOpsCount++;
            }
        });
    }

    // Incluir el borrado de gastos en el mismo mainBatch mientras no supere las 450 operaciones (atomicidad total)
    const remainingExpenseIds: string[] = [];
    for (const expId of expenseIdsToRemove) {
        if (mainBatchOpsCount < 450) {
            mainBatch.delete(doc(db, `consortiums/${consortiumId}/expenses`, expId));
            mainBatchOpsCount++;
        } else {
            remainingExpenseIds.push(expId);
        }
    }

    await mainBatch.commit();

    // Si quedaran más de 450 operaciones, eliminar el excedente en chunks
    const chunkSize = 400;
    for (let i = 0; i < remainingExpenseIds.length; i += chunkSize) {
        const chunk = remainingExpenseIds.slice(i, i + chunkSize);
        const chunkBatch = writeBatch(db);
        for (const id of chunk) {
            chunkBatch.delete(doc(db, `consortiums/${consortiumId}/expenses`, id));
        }
        await chunkBatch.commit();
    }
};

export const getHistory = async (consortiumId: string) => {
    const q = query(collection(db, `consortiums/${consortiumId}/history`), orderBy('dateClosed', 'desc'), limit(50));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as SettlementRecord));
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
export const getPayments = async (consortiumId: string, isAdmin: boolean = true, myUnitIds: string[] = []) => {
    if (isAdmin) {
        const q = query(collection(db, `consortiums/${consortiumId}/payments`), orderBy('date', 'desc'), limit(150));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Payment));
    } else {
        if (myUnitIds.length === 0) return [];
        const chunk = myUnitIds.slice(0, 30);
        const q = query(collection(db, `consortiums/${consortiumId}/payments`), where('unitId', 'in', chunk), limit(100));
        const snapshot = await getDocs(q);
        const results = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Payment));
        return results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 50);
    }
};
export const deletePayment = async (consortiumId: string, paymentId: string) => {
    await deleteDoc(doc(db, `consortiums/${consortiumId}/payments`, paymentId));
};

export const getSettings = async (consortiumId: string): Promise<ConsortiumSettings> => {
    const docRef = doc(db, `consortiums/${consortiumId}/settings`, 'general');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
        const data = snap.data();
        return { 
            showBankDetailsOnCoupon: true,
            ...data, 
            interestRate: data.interestRate !== undefined ? data.interestRate : 5 
        } as ConsortiumSettings;
    } else {
        return { 
            reserveFundBalance: 0, monthlyReserveContributionPercentage: 5, interestRate: 5,
            bankName: '', bankCBU: '', bankAlias: '', bankHolder: '', bankCuit: '',
            address: '', cuit: '', adminName: '',
            showBankDetailsOnCoupon: true
        };
    }
};
export const saveSettings = async (consortiumId: string, settings: ConsortiumSettings) => {
    const docRef = doc(db, `consortiums/${consortiumId}/settings`, 'general');
    await setDoc(docRef, settings, { merge: true });
};
export const uploadConsortiumLogo = async (file: File): Promise<string> => {
    const storage = getStorage();
    const storageRef = ref(storage, `logos/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
};

export const getExpenseTemplates = async (consortiumId: string) => {
    const q = query(collection(db, `consortiums/${consortiumId}/expense_templates`), orderBy('alias'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as ExpenseTemplate));
};
export const addExpenseTemplate = async (consortiumId: string, data: Omit<ExpenseTemplate, 'id'>) => {
    const docRef = await addDoc(collection(db, `consortiums/${consortiumId}/expense_templates`), data);
    return { id: docRef.id, ...data };
};
export const deleteExpenseTemplate = async (consortiumId: string, id: string) => {
    await deleteDoc(doc(db, `consortiums/${consortiumId}/expense_templates`, id));
};

export const getReserveTransactions = async (consortiumId: string) => {
    const q = query(collection(db, `consortiums/${consortiumId}/reserve_transactions`), orderBy('date', 'desc'), limit(200));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ReserveTransaction));
};
export const addReserveTransaction = async (consortiumId: string, data: Omit<ReserveTransaction, 'id'>) => {
    const docRef = await addDoc(collection(db, `consortiums/${consortiumId}/reserve_transactions`), data);
    return { id: docRef.id, ...data };
};
export const updateReserveTransaction = async (consortiumId: string, id: string, updates: Partial<ReserveTransaction>) => {
    const docRef = doc(db, `consortiums/${consortiumId}/reserve_transactions`, id);
    await updateDoc(docRef, updates);
};
export const deleteReserveTransaction = async (consortiumId: string, id: string) => {
    await deleteDoc(doc(db, `consortiums/${consortiumId}/reserve_transactions`, id));
};
export const reconcileReserveTransactionsBatch = async (
    consortiumId: string,
    updates: { id: string; amount: number; description?: string }[],
    toDeleteIds: string[],
    toAddList: Omit<ReserveTransaction, 'id'>[]
) => {
    const batch = writeBatch(db);
    updates.forEach(u => {
        const refDoc = doc(db, `consortiums/${consortiumId}/reserve_transactions`, u.id);
        const payload: any = { amount: Number(u.amount.toFixed(2)) };
        if (u.description) payload.description = u.description;
        batch.update(refDoc, payload);
    });
    toDeleteIds.forEach(id => {
        batch.delete(doc(db, `consortiums/${consortiumId}/reserve_transactions`, id));
    });
    toAddList.forEach(item => {
        const newRef = doc(collection(db, `consortiums/${consortiumId}/reserve_transactions`));
        batch.set(newRef, { ...item, amount: Number(item.amount.toFixed(2)) });
    });
    await batch.commit();
};

export const getAllConsortiums = async () => {
    const snapshot = await getDocs(collection(db, 'consortiums'));
    return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Consortium));
};

export const createJoinRequest = async (data: Omit<JoinRequest, 'id'>) => {
    const normalizedData = { ...data, userEmail: data.userEmail.trim().toLowerCase() };
    const docRef = await addDoc(collection(db, 'join_requests'), normalizedData);
    return { id: docRef.id, ...normalizedData };
};

export const getPendingJoinRequests = async (consortiumId: string) => {
    const q = query(collection(db, 'join_requests'), where('consortiumId', '==', consortiumId));
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as JoinRequest))
        .filter(r => r.status === 'PENDING');
};

export const getUserJoinRequests = async (email: string) => {
    if (!email) return [];
    const cleanEmail = email.trim().toLowerCase();
    const variants = Array.from(new Set([cleanEmail, email.trim()]));
    const reqMap = new Map<string, JoinRequest>();
    for (const v of variants) {
        const q = query(collection(db, 'join_requests'), where('userEmail', '==', v));
        const snapshot = await getDocs(q);
        snapshot.docs.forEach(d => reqMap.set(d.id, { id: d.id, ...d.data() } as JoinRequest));
    }
    return Array.from(reqMap.values());
};

export const updateJoinRequest = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    await updateDoc(doc(db, 'join_requests', id), { status });
};

/**
 * Importación masiva de deudas históricas con writeBatch de Firestore.
 * Procesa en lotes de hasta 450 documentos para garantizar cumplimiento con los límites de Firestore.
 */
export const importDebtsBatch = async (
    consortiumId: string,
    unitDebtsUpdates: { unitId: string; debts: DebtItem[] }[]
): Promise<void> => {
    const CHUNK_SIZE = 450;
    for (let i = 0; i < unitDebtsUpdates.length; i += CHUNK_SIZE) {
        const chunk = unitDebtsUpdates.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(update => {
            const unitRef = doc(db, `consortiums/${consortiumId}/units`, update.unitId);
            batch.update(unitRef, { debts: update.debts });
        });
        await batch.commit();
    }
};