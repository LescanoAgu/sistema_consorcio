import { db, storage } from '../src/config/firebase'; 
import { collection, getDocs, addDoc, updateDoc, doc, query, where, orderBy, Timestamp, setDoc, getDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Unit, Expense, Consortium, SettlementRecord, UserRole, ConsortiumSettings } from '../types'; 

// --- Mapeos ---
const mapUnitFromFirestore = (doc: any): Unit => {
  const data = doc.data();
  return {
    id: doc.id,
    unitNumber: data.nombre || 'Sin Nombre',
    ownerName: data.propietario || 'Desconocido',
    linkedEmail: data.email || '',
    proratePercentage: parseFloat(data.porcentaje) || 0,
    initialBalance: parseFloat(data.saldo) || 0
  };
};

const mapExpenseFromFirestore = (doc: any): Expense => {
  const data = doc.data();
  return {
    id: doc.id,
    description: data.concepto,
    amount: parseFloat(data.monto),
    date: data.fecha instanceof Timestamp ? data.fecha.toDate().toISOString().split('T')[0] : data.fecha,
    category: data.tipo === 'Ordinario' ? 'Ordinary' : 'Extraordinary',
    distributionType: data.distribucion === 'Prorrateo' ? 'PRORATED' : (data.distribucion === 'Fondo' ? 'FROM_RESERVE' : 'EQUAL_PARTS'),
    itemCategory: data.rubro || 'General',
    attachmentUrl: data.comprobanteUrl || '',
    liquidacionId: data.liquidacionId || null
  } as Expense;
};

// --- Consorcios ---
export const getConsortiums = async (): Promise<Consortium[]> => {
  const q = query(collection(db, 'consorcios'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    name: doc.data().nombre,
    address: doc.data().direccion,
    cuit: doc.data().cuit
  }));
};

export const createConsortium = async (consortium: Omit<Consortium, 'id'>) => {
  const docRef = await addDoc(collection(db, 'consorcios'), {
    nombre: consortium.name,
    direccion: consortium.address,
    cuit: consortium.cuit,
    createdAt: new Date()
  });
  // Crear configuración por defecto
  await setDoc(doc(db, `consorcios/${docRef.id}/config`, 'general'), {
      reserveFundBalance: 0,
      monthlyReserveContributionPercentage: 5,
      bankName: 'Banco Nación',
      bankCBU: '',
      bankAlias: '',
      bankHolder: consortium.name,
      bankCuit: consortium.cuit || ''
  });
  return { id: docRef.id, ...consortium };
};

// --- Unidades ---
export const getUnits = async (consortiumId: string): Promise<Unit[]> => {
  const q = query(collection(db, `consorcios/${consortiumId}/unidades`), orderBy('nombre'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapUnitFromFirestore);
};

export const addUnit = async (consortiumId: string, unit: Unit) => {
  const docRef = await addDoc(collection(db, `consorcios/${consortiumId}/unidades`), {
    nombre: unit.unitNumber,
    propietario: unit.ownerName,
    porcentaje: unit.proratePercentage,
    saldo: unit.initialBalance,
    email: unit.linkedEmail,
    createdAt: new Date()
  });
  return { ...unit, id: docRef.id };
};

export const updateUnit = async (consortiumId: string, unit: Unit) => {
    const unitRef = doc(db, `consorcios/${consortiumId}/unidades`, unit.id);
    await updateDoc(unitRef, {
        nombre: unit.unitNumber,
        propietario: unit.ownerName,
        porcentaje: unit.proratePercentage,
        saldo: unit.initialBalance,
        email: unit.linkedEmail
    });
};

export const deleteUnit = async (consortiumId: string, unitId: string) => {
    await deleteDoc(doc(db, `consorcios/${consortiumId}/unidades`, unitId));
};

// --- Gastos ---
export const getExpenses = async (consortiumId: string): Promise<Expense[]> => {
  const q = query(
    collection(db, `consorcios/${consortiumId}/gastos`),
    where("liquidacionId", "==", null), 
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapExpenseFromFirestore);
};

export const addExpense = async (consortiumId: string, expense: Expense) => {
  const newExpense = {
    concepto: expense.description,
    monto: expense.amount,
    fecha: expense.date,
    tipo: expense.category === 'Ordinary' ? 'Ordinario' : 'Extraordinario',
    distribucion: expense.distributionType === 'PRORATED' ? 'Prorrateo' : (expense.distributionType === 'FROM_RESERVE' ? 'Fondo' : 'Iguales'),
    rubro: expense.itemCategory,
    comprobanteUrl: expense.attachmentUrl || '',
    liquidacionId: null,
    createdAt: new Date()
  };
  
  const docRef = await addDoc(collection(db, `consorcios/${consortiumId}/gastos`), newExpense);
  return { ...expense, id: docRef.id };
};

export const updateExpense = async (consortiumId: string, expense: Expense) => {
    const expenseRef = doc(db, `consorcios/${consortiumId}/gastos`, expense.id);
    await updateDoc(expenseRef, {
        concepto: expense.description,
        monto: expense.amount,
        fecha: expense.date,
        tipo: expense.category === 'Ordinary' ? 'Ordinario' : 'Extraordinario',
        distribucion: expense.distributionType === 'PRORATED' ? 'Prorrateo' : (expense.distributionType === 'FROM_RESERVE' ? 'Fondo' : 'Iguales'),
        rubro: expense.itemCategory,
    });
};

export const deleteExpense = async (consortiumId: string, expenseId: string) => {
    await deleteDoc(doc(db, `consorcios/${consortiumId}/gastos`, expenseId));
};

// --- Configuración (Settings) ---
export const getSettings = async (consortiumId: string): Promise<ConsortiumSettings> => {
    const docRef = doc(db, `consorcios/${consortiumId}/config`, 'general');
    const snap = await getDoc(docRef);
    if (snap.exists()) return snap.data() as ConsortiumSettings;
    return {
        reserveFundBalance: 0,
        monthlyReserveContributionPercentage: 5,
        bankName: '', bankCBU: '', bankAlias: '', bankHolder: '', bankCuit: ''
    };
};

export const saveSettings = async (consortiumId: string, settings: ConsortiumSettings) => {
    const docRef = doc(db, `consorcios/${consortiumId}/config`, 'general');
    await setDoc(docRef, settings, { merge: true });
};

// --- Liquidaciones ---
export const saveSettlement = async (consortiumId: string, settlement: SettlementRecord, expenseIds: string[]) => {
  const batch = writeBatch(db);

  // 1. Crear el registro de liquidación
  const settlementRef = doc(collection(db, `consorcios/${consortiumId}/liquidaciones`));
  batch.set(settlementRef, {
    ...settlement,
    id: settlementRef.id,
    createdAt: new Date()
  });

  // 2. Marcar los gastos como liquidados
  expenseIds.forEach(expId => {
    const expRef = doc(db, `consorcios/${consortiumId}/gastos`, expId);
    batch.update(expRef, { liquidacionId: settlementRef.id });
  });

  // 3. Actualizar el saldo del fondo en la configuración
  const configRef = doc(db, `consorcios/${consortiumId}/config`, 'general');
  batch.update(configRef, { reserveFundBalance: settlement.reserveBalanceAtClose });

  await batch.commit();
  return settlementRef.id;
};

export const getHistory = async (consortiumId: string): Promise<SettlementRecord[]> => {
    const q = query(collection(db, `consorcios/${consortiumId}/liquidaciones`), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as SettlementRecord);
}

// --- Archivos (Storage) ---
export const uploadReceipt = async (file: File, consortiumId: string): Promise<string> => {
  const storageRef = ref(storage, `consorcios/${consortiumId}/comprobantes/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
};