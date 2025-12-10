import { db, storage } from '../src/config/firebase'; 
import { collection, getDocs, addDoc, updateDoc, doc, query, where, orderBy, Timestamp, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Unit, Expense, Consortium, SettlementRecord, UserRole } from '../types'; 

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
    distributionType: data.distribucion === 'Prorrateo' ? 'PRORATED' : 'EQUAL_PARTS',
    itemCategory: data.rubro || 'General',
    attachmentUrl: data.comprobanteUrl || ''
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
  return { id: docRef.id, ...consortium };
};

// --- Unidades (Propiedades) ---
export const getUnits = async (consortiumId: string): Promise<Unit[]> => {
  const q = query(collection(db, `consorcios/${consortiumId}/unidades`));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapUnitFromFirestore);
};

// ✅ ESTA ES LA FUNCIÓN QUE FALTABA PARA GUARDAR EL CSV
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

// --- Gastos ---
export const getExpenses = async (consortiumId: string): Promise<Expense[]> => {
  const q = query(
    collection(db, `consorcios/${consortiumId}/gastos`),
    where("liquidacionId", "==", null), // Solo gastos pendientes
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
    distribucion: 'Prorrateo', // Simplificado por ahora
    rubro: expense.itemCategory,
    comprobanteUrl: expense.attachmentUrl || '',
    liquidacionId: null,
    createdAt: new Date()
  };
  
  const docRef = await addDoc(collection(db, `consorcios/${consortiumId}/gastos`), newExpense);
  return { ...expense, id: docRef.id };
};

// --- Archivos (Storage) ---
// ✅ SOLUCIÓN AL CONGELAMIENTO: Subida real a Firebase Storage
export const uploadReceipt = async (file: File, consortiumId: string): Promise<string> => {
  const storageRef = ref(storage, `comprobantes/${consortiumId}/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
};

// --- Liquidaciones (Cierre de Mes) ---
export const saveSettlement = async (consortiumId: string, settlement: SettlementRecord) => {
  // 1. Guardar el registro de la liquidación
  const settlementRef = await addDoc(collection(db, `consorcios/${consortiumId}/liquidaciones`), {
    ...settlement,
    createdAt: new Date()
  });

  // 2. Marcar los gastos como "liquidados" para que no salgan el próximo mes
  // Nota: Esto debería hacerse en batch, pero por simplicidad lo haremos uno por uno o lo dejamos para una cloud function.
  // Por ahora, asumimos que el front limpia la vista, pero lo ideal es actualizar los gastos aquí.
};

// --- Usuarios ---
export const saveUserProfile = async (uid: string, data: { email: string, role: UserRole, name: string }) => {
  await setDoc(doc(db, 'users', uid), data);
};

export const getUserRole = async (uid: string): Promise<UserRole | null> => {
  try {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) return docSnap.data().role as UserRole;
    return null;
  } catch (error) {
    return null;
  }
};