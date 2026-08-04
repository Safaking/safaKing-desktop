import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export async function generateInvoicePDF(data: any, type: 'RENTAL' | 'SALE' = 'RENTAL', action: 'download' | 'print' = 'download') {
  const doc = new jsPDF();
  const primaryColor: [number, number, number] = [30, 96, 122]; // Teal #1e607a
  const secondaryColor: [number, number, number] = [240, 240, 240]; // Light Grey
  const accentColor: [number, number, number] = [217, 236, 245]; // Light Blue for Total
  
  // No background header bar - keeping it white
  
  // Add Logo
  try {
    const logoImg = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = '/assets/logo.png?v=3';
    });
    // Positioned at top left
    doc.addImage(logoImg, 'PNG', 15, 10, 40, 25);
  } catch (e) {
    console.error('Failed to load logo for PDF', e);
  }

  // Add Hindi Font support
  try {
    const fontRes = await fetch('/assets/NotoSansDevanagari-Regular.ttf');
    const fontBlob = await fontRes.arrayBuffer();
    const fontBase64 = btoa(
      new Uint8Array(fontBlob)
        .reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    doc.addFileToVFS('NotoSans.ttf', fontBase64);
    doc.addFont('NotoSans.ttf', 'NotoSans', 'normal');
  } catch (e) {
    console.error('Failed to load Hindi font', e);
  }

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', 195, 25, { align: 'right' });
  
  doc.setFontSize(10);
  doc.setCharSpace(0);
  doc.setFont('helvetica', 'normal');
  doc.text('Near Pandya Memorial School,', 195, 32, { align: 'right' });
  doc.text('Char Khamba, Partapur, Banswara (Raj) 327024', 195, 37, { align: 'right' });
  doc.text('Phone: +91 90013 47143, 76918 56577', 195, 42, { align: 'right' });
  doc.text('Email: joshisafahouse@gmail.com', 195, 47, { align: 'right' });

  // Invoice / Bill To Details
  doc.setFontSize(12);
  
  // Left Side: Invoice Details
  const startDetailsY = 65;
  doc.setFont('helvetica', 'bold');
  doc.text('Invoice No:', 20, startDetailsY);
  doc.text('Date:', 20, startDetailsY + 7);
  doc.text('Due Date:', 20, startDetailsY + 14);
  doc.text('Payment Mode:', 20, startDetailsY + 21);
  doc.text('Payment Status:', 20, startDetailsY + 28);
  
  doc.setFont('helvetica', 'normal');
  doc.text(data.orderNumber || 'INV-001', 65, startDetailsY);
  doc.text(format(new Date(), 'dd MMM yyyy'), 65, startDetailsY + 7);
  const dueDate = type === 'RENTAL' ? format(new Date(data.endDate), 'dd MMM yyyy') : format(new Date(), 'dd MMM yyyy');
  doc.text(dueDate, 65, startDetailsY + 14);
  doc.text((data.paymentMethod || data.invoice?.paymentMethod || 'CASH').toUpperCase(), 65, startDetailsY + 21);
  
  const paid = parseFloat(data.paidAmount?.toString() || '0');
  const total = parseFloat(data.totalAmount?.toString() || '0');
  const payStatus = paid >= total && total > 0 ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'DUE');
  doc.setFont('helvetica', 'bold');
  doc.text(payStatus, 65, startDetailsY + 28);

  // Right Side: Bill To
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', 195, startDetailsY, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(data.customerName || 'Client name', 195, startDetailsY + 7, { align: 'right' });
  
  let billToY = startDetailsY + 14;
  if (data.fatherName) {
    doc.text(`S/O: ${data.fatherName}`, 195, billToY, { align: 'right' });
    billToY += 7;
  }
  if (data.customerAddress) {
    const splitAddress = doc.splitTextToSize(data.customerAddress, 80);
    doc.text(splitAddress, 195, billToY, { align: 'right' });
    billToY += splitAddress.length * 6;
  }
  if (data.customerPhone) {
    doc.text(`Phone: ${data.customerPhone}`, 195, billToY, { align: 'right' });
    billToY += 7;
  }
  if (data.customerAltPhone) {
    doc.text(`Alt Phone: ${data.customerAltPhone}`, 195, billToY, { align: 'right' });
    billToY += 7;
  }

  // Business Specific Details
  let detailY = Math.max(startDetailsY + 16, billToY - 2);
  doc.setFontSize(12);
  if (data.weddingDate) {
    doc.setFont('helvetica', 'bold');
    doc.text('Wedding Date:', 20, detailY);
    doc.setFont('helvetica', 'normal');
    doc.text(data.weddingDate, 65, detailY);
    detailY += 7;
  }
  if (data.safaSize) {
    doc.setFont('helvetica', 'bold');
    doc.text('Safa Size:', 20, detailY);
    doc.setFont('helvetica', 'normal');
    doc.text(data.safaSize, 65, detailY);
    detailY += 7;
  }
  if (data.tieSafa) {
    doc.setFont('helvetica', 'bold');
    doc.text('Safa Tying Info:', 20, detailY);
    doc.setFont('helvetica', 'normal');
    // Prefer the per-style breakdown when present ("Jodhpuri x10, Rounded x5"),
    // falling back to the plain shape string on older orders.
    let styleStr = data.safaShape ? `Style: ${data.safaShape}` : '';
    try {
      const styles = data.safaTyingStyles ? JSON.parse(data.safaTyingStyles) : null;
      if (Array.isArray(styles) && styles.length > 0) {
        styleStr = `Style: ${styles.map((s: any) => `${s.name} x${s.quantity}`).join(', ')}`;
      }
    } catch {
      // Malformed JSON — keep the safaShape fallback.
    }

    const tyingInfoStr = [
      styleStr,
      `Qty: ${data.safaTyingCount || 1} pcs`,
      data.safaTyingName ? `Contact: ${data.safaTyingName}` : '',
      data.safaTyingTime ? `Time: ${data.safaTyingTime}` : '',
      data.safaTyingDate ? `Date: ${data.safaTyingDate}` : '',
      data.safaTyingAddress ? `Venue: ${data.safaTyingAddress}` : ''
    ].filter(Boolean).join(' | ');
    
    const splitTyingInfo = doc.splitTextToSize(tyingInfoStr, 110);
    doc.text(splitTyingInfo, 65, detailY);
    detailY += splitTyingInfo.length * 6;
  }

  let currentY = detailY + 5;

  const tableItems = data.items.map((item: any, index: number) => [
    index + 1,
    item.product?.name || item.name || 'Item',
    item.quantity,
    `${(item.pricePerDay || item.price).toFixed(2)}`,
    `${((item.pricePerDay || item.price) * item.quantity).toFixed(2)}`
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Item Description', 'Qty', 'Rate', 'Amount']],
    body: tableItems,
    theme: 'grid',
    headStyles: { 
      fillColor: [0, 0, 0], 
      textColor: [255, 255, 255], 
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'center'
    },
    styles: { 
      fontSize: 10, 
      cellPadding: 4, 
      textColor: [0, 0, 0],
      lineWidth: 0.1,
      lineColor: [0, 0, 0]
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 100 },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' },
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 15;
  
  // Totals Section (on the right)
  doc.setFontSize(10);
  const totalLabelX = 160;
  const totalValueX = 195;
  let currentTotalY = finalY;

  const itemTotal = data.items.reduce((sum: number, item: any) => sum + ((item.pricePerDay || item.price) * item.quantity), 0);

  doc.setFont('helvetica', 'bold');
  doc.text('Item Total:', totalLabelX, currentTotalY, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(`Rs. ${itemTotal.toFixed(2)}`, totalValueX, currentTotalY, { align: 'right' });
  currentTotalY += 7;

  if (data.tieSafa) {
    doc.setFont('helvetica', 'bold');
    doc.text('Safa Tying Charge:', totalLabelX, currentTotalY, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(`Rs. ${(data.tieSafaCharge || 50).toFixed(2)}`, totalValueX, currentTotalY, { align: 'right' });
    currentTotalY += 7;
  }

  if (data.discount > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Discount:', totalLabelX, currentTotalY, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(`- Rs. ${data.discount.toFixed(2)}`, totalValueX, currentTotalY, { align: 'right' });
    currentTotalY += 7;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Total Amount:', totalLabelX, currentTotalY, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(`Rs. ${data.totalAmount.toFixed(2)}`, totalValueX, currentTotalY, { align: 'right' });
  currentTotalY += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('Advanced Amount:', totalLabelX, currentTotalY, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(`Rs. ${(data.paidAmount || 0).toFixed(2)}`, totalValueX, currentTotalY, { align: 'right' });
  currentTotalY += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('Tax (0%):', totalLabelX, currentTotalY, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(`Rs. 0.00`, totalValueX, currentTotalY, { align: 'right' });
  currentTotalY += 4;

  // Final Total Bar
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(140, currentTotalY, 195, currentTotalY);
  currentTotalY += 7;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Balance Due:', totalLabelX, currentTotalY, { align: 'right' });
  doc.text(`Rs. ${(data.remainingAmount || 0).toFixed(2)}`, totalValueX, currentTotalY, { align: 'right' });

  // Terms Section (below totals)
  let termsStartY = currentTotalY + 15;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Terms & Conditions:', 20, termsStartY);
  
  // Helper to render Hindi text to a canvas and return data URL
  const getHindiImage = (text: string, fontSize: number = 20) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const font = `${fontSize}px "NotoSans", sans-serif`;
    ctx.font = font;
    const metrics = ctx.measureText(text);
    canvas.width = metrics.width;
    canvas.height = fontSize * 1.5;
    ctx.font = font;
    ctx.fillStyle = 'black';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, canvas.height / 2);
    
    // Safety check to prevent overflow - max width 170 units
    const maxPdfWidth = 170;
    let pdfWidth = metrics.width / 4.5;
    let pdfHeight = (fontSize * 1.5) / 4.5;
    
    if (pdfWidth > maxPdfWidth) {
      const ratio = maxPdfWidth / pdfWidth;
      pdfWidth = maxPdfWidth;
      pdfHeight = pdfHeight * ratio;
    }

    return {
      dataUrl: canvas.toDataURL('image/png'),
      width: pdfWidth,
      height: pdfHeight
    };
  };

  const termsList = [
    '1. किराये की आधी रकम देने पर ही बुकिंग की जायेगी।',
    '2. सामान लेने पर बाकी किराया जमा करना होगा। उसके बाद ही सामग्री मिलेगी।',
    '3. सामान की टूट-फूट या कटा-फटा की जिम्मेदारी ग्राहक की स्वयं की रहेगी व ग्राहक को इसकी पूरी कीमत देनी होगी।'
  ];
  
  let termsY = termsStartY + 7;
  for (const term of termsList) {
    const hindiImg = getHindiImage(term);
    doc.addImage(hindiImg.dataUrl, 'PNG', 20, termsY, hindiImg.width, hindiImg.height);
    termsY += hindiImg.height + 2;
  }

  if (data.notes) {
    doc.setFont('helvetica', 'italic');
    doc.text(`Note: ${data.notes}`, 20, termsY + 2);
  }

  // Footer text only
  const pageHeight = doc.internal.pageSize.height;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.text('Thank you for choosing Joshi Safa House!', 105, pageHeight - 15, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Computer Generated Invoice', 105, pageHeight - 10, { align: 'center' });

  if (action === 'print') {
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  } else {
    doc.save(`invoice-${data.orderNumber || 'new'}.pdf`);
  }
}
