import { db } from '../src/config/firebase'; // Sube uno (..) y entra a src/config
import { collection, getDocs, addDoc, updateDoc, doc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { Unit, Expense, Consortium } from '../types'; // Sube uno (..) a la raíz para los tipos

// --- Mapeo de Datos (Traducción BD Vieja -> App Nueva) ---

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
    itemCategory: data.rubro || 'General'
  } as Expense;
};

// --- Servicios de Consorcios ---

export const getConsortiums = async (): Promise<Consortium[]> => {
  const q = query(collection(db, 'consorcios'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    name: doc.data().nombre || 'Consorcio Sin Nombre',
    address: doc.data().direccion || '',
    cuit: doc.data().cuit || ''
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

// --- Servicios de Unidades ---

export const getUnits = async (consortiumId: string): Promise<Unit[]> => {
  const q = query(collection(db, `consorcios/${consortiumId}/unidades`));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapUnitFromFirestore);
};

export const updateUnitBalance = async (consortiumId: string, unitId: string, newBalance: number) => {
  const unitRef = doc(db, `consorcios/${consortiumId}/unidades`, unitId);
  await updateDoc(unitRef, { saldo: newBalance });
};

// --- Servicios de Gastos ---

export const getExpenses = async (consortiumId: string): Promise<Expense[]> => {
  const q = query(
    collection(db, `consorcios/${consortiumId}/gastos`),
    where("liquidacionId", "==", null),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapExpenseFromFirestore);
};

export const addExpense = async (consortiumId: string, expense: Omit<Expense, 'id'>) => {
  const newExpense = {
    concepto: expense.description,
    monto: expense.amount,
    fecha: expense.date,
    tipo: expense.category === 'Ordinary' ? 'Ordinario' : 'Extraordinario',
    distribucion: 'Prorrateo',
    liquidacionId: null,
    createdAt: new Date()
  };
  
  const docRef = await addDoc(collection(db, `consorcios/${consortiumId}/gastos`), newExpense);
  return { id: docRef.id, ...expense };
};