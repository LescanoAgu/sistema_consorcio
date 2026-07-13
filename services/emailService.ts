import emailjs from '@emailjs/browser';
import { Unit } from '../types';

// AHORA SÍ: Leemos desde las variables de entorno seguras
const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
const TEMPLATE_ID_ANNOUNCEMENT = import.meta.env.VITE_EMAILJS_TEMPLATE_ID_ANNOUNCEMENT;
const TEMPLATE_ID_SETTLEMENT = import.meta.env.VITE_EMAILJS_TEMPLATE_ID_SETTLEMENT;

export const initEmailService = () => {
    emailjs.init(PUBLIC_KEY);
};

// --- ENVIAR AVISO GENERAL ---
export const sendAnnouncementEmail = async (units: Unit[], title: string, content: string) => {
    // Filtramos unidades que tengan emails configurados y aplanamos la lista de envíos
    const emailPromises: Promise<any>[] = [];
    
    units.forEach(unit => {
        if (unit.authorizedEmails && unit.authorizedEmails.length > 0) {
            unit.authorizedEmails.forEach(email => {
                if (email && email.includes('@')) {
                    const templateParams = {
                        to_email: email,
                        owner_name: unit.ownerName,
                        title: title,
                        content: content
                    };
                    emailPromises.push(emailjs.send(SERVICE_ID, TEMPLATE_ID_ANNOUNCEMENT, templateParams));
                }
            });
        }
    });

    console.log(`Enviando ${emailPromises.length} avisos...`);

    try {
        await Promise.all(emailPromises);
        console.log("Todos los avisos enviados.");
        return true;
    } catch (error) {
        console.error("Error enviando emails:", error);
        return false;
    }
};

// --- ENVIAR AVISO DE EXPENSAS (INDIVIDUALIZADO) ---
export const sendSettlementEmail = async (units: Unit[], month: string, dueDate: string, unitDetails: {unitId: string, totalToPay: number}[]) => {
    
    const emailPromises: Promise<any>[] = [];
    
    units.forEach(unit => {
        if (unit.authorizedEmails && unit.authorizedEmails.length > 0) {
            // Buscamos cuánto paga ESTA unidad específica
            const detail = unitDetails.find(d => d.unitId === unit.id);
            const amount = detail ? detail.totalToPay.toFixed(2) : '0.00';

            unit.authorizedEmails.forEach(email => {
                if (email && email.includes('@')) {
                    const templateParams = {
                        to_email: email,
                        owner_name: unit.ownerName,
                        month: month,
                        amount: amount,
                        due_date: dueDate
                    };
                    emailPromises.push(emailjs.send(SERVICE_ID, TEMPLATE_ID_SETTLEMENT, templateParams));
                }
            });
        }
    });

    try {
        await Promise.all(emailPromises);
        return true;
    } catch (error) {
        console.error("Error enviando liquidaciones:", error);
        return false;
    }
};