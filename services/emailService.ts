import emailjs from '@emailjs/browser';
import { Unit } from '../types';

// REEMPLAZA ESTOS VALORES CON LOS TUYOS DE EMAILJS
const SERVICE_ID = 'ku5b•••••••••••••••••';
const PUBLIC_KEY = 'lgbzpFx02o6XhVAFw';
const TEMPLATE_ID_ANNOUNCEMENT = 'template_mmvgspu';
const TEMPLATE_ID_SETTLEMENT = 'template_zuox6yl';

export const initEmailService = () => {
    emailjs.init(PUBLIC_KEY);
};

// --- ENVIAR AVISO GENERAL ---
export const sendAnnouncementEmail = async (units: Unit[], title: string, content: string) => {
    // Filtramos unidades que tengan email configurado
    const recipients = units.filter(u => u.linkedEmail && u.linkedEmail.includes('@'));
    
    console.log(`Enviando avisos a ${recipients.length} propietarios...`);

    // EmailJS gratis tiene límite de velocidad, enviamos en serie
    const promises = recipients.map(unit => {
        const templateParams = {
            to_email: unit.linkedEmail,
            owner_name: unit.ownerName,
            title: title,
            content: content
        };

        return emailjs.send(SERVICE_ID, TEMPLATE_ID_ANNOUNCEMENT, templateParams);
    });

    try {
        await Promise.all(promises);
        console.log("Todos los avisos enviados.");
        return true;
    } catch (error) {
        console.error("Error enviando emails:", error);
        return false;
    }
};

// --- ENVIAR AVISO DE EXPENSAS (INDIVIDUALIZADO) ---
export const sendSettlementEmail = async (units: Unit[], month: string, dueDate: string, unitDetails: {unitId: string, totalToPay: number}[]) => {
    
    const promises = units
        .filter(u => u.linkedEmail) // Solo los que tienen mail
        .map(unit => {
            // Buscamos cuánto paga ESTA unidad específica
            const detail = unitDetails.find(d => d.unitId === unit.id);
            const amount = detail ? detail.totalToPay.toFixed(2) : '0.00';

            const templateParams = {
                to_email: unit.linkedEmail,
                owner_name: unit.ownerName,
                month: month,
                amount: amount,
                due_date: dueDate
            };

            return emailjs.send(SERVICE_ID, TEMPLATE_ID_SETTLEMENT, templateParams);
        });

    try {
        await Promise.all(promises);
        return true;
    } catch (error) {
        console.error("Error enviando liquidaciones:", error);
        return false;
    }
};