const PDFDocument = require('pdfkit');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

class PDFService {
  // Generar recibo de compra
  static async generateReceiptPDF(booking, showtime, seats, totalPrice, qrFilePath) {
    try {
      // Crear directorio para recibos
      const receiptsDir = path.join(__dirname, '../../storage/receipts');
      await PDFService.ensureDirectoryExists(receiptsDir);

      const filename = `recibo-${booking.transaction_id}.pdf`;
      const filePath = path.join(receiptsDir, filename);

      return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(filePath);

        doc.pipe(stream);

        // Header del recibo
        PDFService.addReceiptHeader(doc, booking);

        // Información de la compra (ahora incluye QR)
        PDFService.addBookingDetails(doc, booking, showtime, seats, qrFilePath);

        // Desglose de precios
        PDFService.addPriceBreakdown(doc, totalPrice, seats.length);

        // Términos y condiciones
        PDFService.addTermsAndConditions(doc);

        // Footer
        PDFService.addReceiptFooter(doc);

        doc.end();

        stream.on('finish', () => {
          resolve(`/storage/receipts/${filename}`);
        });

        stream.on('error', (error) => {
          reject(error);
        });
      });
    } catch (error) {
      throw error;
    }
  }

  // Header del recibo
  static addReceiptHeader(doc, booking) {
    doc.fontSize(20)
      .font('Helvetica-Bold')
      .fillColor('#1a365d')
      .text('CINE CONNECT', 50, 50, { align: 'center' });

    doc.fontSize(12)
      .font('Helvetica')
      .fillColor('#666666')
      .text('Sistema de Reservas de Cine', 50, 75, { align: 'center' });

    // Línea separadora
    doc.moveTo(50, 100)
      .lineTo(550, 100)
      .strokeColor('#e2e8f0')
      .lineWidth(1)
      .stroke();

    // Información del recibo
    doc.fontSize(16)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('COMPROBANTE DE RESERVA', 50, 120, { align: 'center' });

    doc.fontSize(10)
      .font('Helvetica')
      .fillColor('#666666')
      .text(`Nº Transacción: ${booking.transaction_id}`, 50, 150)
      .text(`Fecha: ${new Date(booking.purchase_date).toLocaleDateString('es-ES')}`, 300, 150)
      .text(`Hora: ${new Date(booking.purchase_date).toLocaleTimeString('es-ES')}`, 450, 150);
  }

  // Detalles de la reserva (con QR a la derecha)
  static addBookingDetails(doc, booking, showtime, seats, qrFilePath) {
    let yPosition = 190;

    doc.fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('DETALLES DE LA FUNCIÓN', 50, yPosition);

    yPosition += 25;

    doc.fontSize(10)
      .font('Helvetica')
      .fillColor('#333333')
      .text(`Película: ${showtime.movie.title}`, 70, yPosition)
      .text(`Género: ${showtime.movie.genre}`, 300, yPosition);

    yPosition += 20;

    doc.text(`Sala: ${showtime.room.name}`, 70, yPosition)
      .text(`Ubicación: ${showtime.room.location}`, 300, yPosition);

    yPosition += 20;

    doc.text(`Fecha: ${new Date(showtime.date).toLocaleDateString('es-ES')}`, 70, yPosition)
      .text(`Hora: ${showtime.time}`, 300, yPosition);

    // === Agregar QR en la parte derecha ===
    if (qrFilePath) {
      try {
        const qrX = 450; // posición horizontal
        const qrY = 190; // alineado con el bloque de detalles
        doc.image(qrFilePath, qrX, qrY, { width: 100, height: 100 });
      } catch (err) {
        console.warn('⚠️ No se pudo agregar QR al PDF:', err.message);
      }
    }

    yPosition += 40;

    // Asientos
    doc.fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('ASIENTOS RESERVADOS:', 50, yPosition);

    yPosition += 20;

    seats.forEach((seat, index) => {
      const column = index % 2 === 0 ? 70 : 300;
      const rowOffset = Math.floor(index / 2) * 15;

      doc.fontSize(10)
        .font('Helvetica')
        .fillColor('#333333')
        .text(`• ${seat.row}${seat.number} (${PDFService.getSeatTypeLabel(seat.type)})`, column, yPosition + rowOffset);
    });

    yPosition += Math.ceil(seats.length / 2) * 15 + 20;

    // Información del cliente
    doc.fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('INFORMACIÓN DEL CLIENTE:', 50, yPosition);

    yPosition += 20;

    doc.fontSize(10)
      .font('Helvetica')
      .fillColor('#333333')
      .text(`Email: ${booking.customer_email}`, 70, yPosition)
      .text(`Teléfono: ${booking.customer_phone || 'No proporcionado'}`, 300, yPosition);
  }

  // Desglose de precios
  static addPriceBreakdown(doc, totalPrice, seatCount) {
    let yPosition = doc.y + 30;

    doc.fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('DESGLOSE DE PAGO', 50, yPosition);

    yPosition += 25;

    const subtotal = totalPrice / 1.05;
    const serviceFee = subtotal * 0.05;

    doc.fontSize(10)
      .font('Helvetica')
      .fillColor('#333333')
      .text(`Subtotal (${seatCount} asientos):`, 70, yPosition)
      .text(`Q${subtotal.toFixed(2)}`, 450, yPosition, { align: 'right' });

    yPosition += 15;

    doc.text('Cargos por servicio (5%):', 70, yPosition)
      .text(`Q${serviceFee.toFixed(2)}`, 450, yPosition, { align: 'right' });

    yPosition += 20;

    doc.moveTo(70, yPosition)
      .lineTo(450, yPosition)
      .strokeColor('#e2e8f0')
      .lineWidth(1)
      .stroke();

    yPosition += 15;

    doc.fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#1a365d')
      .text('TOTAL:', 70, yPosition)
      .text(`Q${totalPrice.toFixed(2)}`, 450, yPosition, { align: 'right' });
  }

  // Términos y condiciones
  static addTermsAndConditions(doc) {
    let yPosition = doc.y + 40;

    doc.fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('TÉRMINOS Y CONDICIONES:', 50, yPosition);

    yPosition += 15;

    const terms = [
      '• Los boletos no son reembolsables ni transferibles',
      '• Llegar al menos 15 minutos antes de la función',
      '• Presentar este comprobante o código QR en la entrada',
      '• No se permiten cambios después de la compra',
      '• Para asistencia, contactar: soporte@cineconnect.com'
    ];

    terms.forEach((term, index) => {
      doc.fontSize(8)
        .font('Helvetica')
        .fillColor('#666666')
        .text(term, 70, yPosition + (index * 12));
    });
  }

  // Footer del recibo
  static addReceiptFooter(doc) {
    const yPosition = doc.page.height - 100;

    doc.fontSize(8)
      .font('Helvetica')
      .fillColor('#999999')
      .text('Gracias por su compra. ¡Disfrute de la película!', 50, yPosition, { align: 'center' })
      .text('Cine Connect - Sistema de Reservas', 50, yPosition + 15, { align: 'center' })
      .text('www.cineconnect.com - Tel: +502 1234-5678', 50, yPosition + 30, { align: 'center' });
  }

  static getSeatTypeLabel(type) {
    const labels = {
      'standard': 'Estándar',
      'premium': 'Premium',
      'vip': 'VIP'
    };
    return labels[type] || type;
  }

  static async ensureDirectoryExists(dirPath) {
    try {
      await fsPromises.access(dirPath);
    } catch (error) {
      await fsPromises.mkdir(dirPath, { recursive: true });
    }
  }

static async generateSalesReport(reportData, period) {
  try {
    const reportsDir = path.join(__dirname, '../../storage/reports');
    await PDFService.ensureDirectoryExists(reportsDir);

    const filename = `reporte-ventas-${period}-${Date.now()}.pdf`;
    const filePath = path.join(reportsDir, filename);

    return await new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 50,
        size: 'A4',
        bufferPages: true,
        info: {
          Title: `Reporte de Ventas - ${period}`,
          Author: 'Cine Connect',
          Subject: 'Reporte de ventas y estadísticas del cine',
          Keywords: 'ventas, cine, reporte, estadísticas',
          CreationDate: new Date()
        }
      });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // ==== Estilos y helpers (idénticos al diseño "nítido") ====
      const palette = {
        ink: '#1A202C',
        sub: '#4A5568',
        faint: '#718096',
        line: '#E2E8F0',
        brand: '#1a365d',
        light: '#F7FAFC',
        bar: '#60A5FA'
      };
      const PAGE = { headerH: 100, footerH: 40, margin: 50 };
      const usableWidth = () => doc.page.width - PAGE.margin * 2;
      const ensureSpace = (needed) => {
        if (doc.y + needed > (doc.page.height - PAGE.footerH - 10)) doc.addPage();
      };
      const hr = (y = doc.y, color = palette.line) => {
        doc.save()
          .moveTo(PAGE.margin, y)
          .lineTo(doc.page.width - PAGE.margin, y)
          .strokeColor(color)
          .lineWidth(1)
          .stroke()
          .restore();
      };
      const fmtQ  = (n) => `Q${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const fmtInt = (n) => Number(n || 0).toLocaleString('es-GT');
      const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

      const para = (text, opts = {}) => {
        if (!text) return;
        const { align = 'left', font = 'Helvetica', fontSize = 10, lineGap = 2, color = palette.sub } = opts;
        doc.font(font).fontSize(fontSize).fillColor(color);
        const lines = String(text).split('\n');
        lines.forEach((line, i) => {
          if (i > 0) doc.moveDown(0.25);
          const approx = fontSize + lineGap + 2;
          if (doc.y + approx > (doc.page.height - PAGE.footerH - 10)) doc.addPage();
          doc.text(line, PAGE.margin, doc.y, { width: usableWidth(), align, lineGap });
        });
      };

      const section = (title, reserve = 80) => {
        const titleH = 36;
        if (doc.y + titleH + reserve > (doc.page.height - PAGE.footerH - 10)) doc.addPage();
        doc.fillColor(palette.ink).font('Helvetica-Bold').fontSize(14)
          .text(title, PAGE.margin, doc.y, { width: usableWidth(), align: 'left' });
        hr(doc.y + 6, '#EDF2F7');
        doc.moveDown(1.2);
      };

      const kpiGrid = (items) => {
        const cols = 2, gap = 16;
        const colW = (usableWidth() - gap) / cols;
        const rowH = 60;
        ensureSpace(rowH * Math.ceil(items.length / cols) + 10);
        const startY = doc.y;
        items.forEach((it, i) => {
          const r = Math.floor(i / cols), c = i % cols;
          const x = PAGE.margin + c * (colW + gap);
          const y = startY + r * (rowH + 10);
          doc.save();
          doc.roundedRect(x, y, colW, rowH, 10).fill(palette.light).strokeColor(palette.line).lineWidth(1).stroke();
          doc.fillColor(palette.sub).font('Helvetica-Bold').fontSize(9).text(it.label, x + 12, y + 10, { width: colW - 24 });
          doc.fillColor(palette.brand).font('Helvetica-Bold').fontSize(16).text(it.value, x + 12, y + 28, { width: colW - 24 });
          if (it.hint) doc.fillColor(palette.faint).font('Helvetica').fontSize(8).text(it.hint, x + 12, y + 46, { width: colW - 24 });
          doc.restore();
        });
        doc.y = startY + Math.ceil(items.length / cols) * (rowH + 10);
      };

      const table = ({ columns, rows, widths }) => {
        const rowH = 20, startX = PAGE.margin, tableW = widths.reduce((a,b)=>a+b,0);
        ensureSpace(rowH * (rows.length + 2));
        let y = doc.y;
        doc.save().rect(startX, y, tableW, rowH).fill('#F1F5F9').restore();
        let x = startX;
        columns.forEach((c, i) => {
          doc.fillColor(palette.ink).font('Helvetica-Bold').fontSize(9)
            .text(c.header, x + 8, y + 5, { width: widths[i] - 16, align: c.align || 'left' });
          x += widths[i];
        });
        y += rowH;
        rows.forEach((r, idx) => {
          const zebra = idx % 2 ? '#FBFDFF' : '#FFFFFF';
          if (y + rowH > (doc.page.height - PAGE.footerH - 10)) { doc.addPage(); y = doc.y; }
          doc.save().rect(startX, y, tableW, rowH).fill(zebra).restore();
          let xi = startX;
          columns.forEach((c, i) => {
            doc.fillColor(palette.sub).font('Helvetica').fontSize(9)
              .text(String(r[c.key] ?? ''), xi + 8, y + 5, { width: widths[i] - 16, align: c.align || 'left' });
            xi += widths[i];
          });
          doc.save().moveTo(startX, y).lineTo(startX + tableW, y).strokeColor(palette.line).lineWidth(1).stroke().restore();
          y += rowH;
        });
        doc.save().rect(startX, doc.y, tableW, (rows.length + 1) * rowH).strokeColor(palette.line).lineWidth(1).stroke().restore();
        doc.y = y + 10;
      };

      const barChart = ({ title, data, labelKey, valueKey, height = 150, maxBars = 14, valueFmt }) => {
        if (!Array.isArray(data) || !data.length) return;
        const ds = data.slice(-maxBars);
        const x0 = PAGE.margin, W = usableWidth(), y0 = doc.y + 18;
        ensureSpace(height + 60);
        doc.fillColor(palette.ink).font('Helvetica-Bold').fontSize(11).text(title, PAGE.margin, doc.y, { width: W, align: 'left' });
        doc.moveDown(0.2);
        const baseY = y0 + height;
        doc.save();
        const steps = 4;
        for (let i = 0; i <= steps; i++) {
          const gy = y0 + (height * i / steps);
          doc.moveTo(x0, gy).lineTo(x0 + W, gy).strokeColor('#EEF2F7').lineWidth(1).stroke();
        }
        doc.moveTo(x0, baseY).lineTo(x0 + W, baseY).strokeColor(palette.line).lineWidth(1.2).stroke();
        doc.restore();
        const maxVal = Math.max(...ds.map(d => Number(d[valueKey]) || 0), 1);
        const gap = 8, barW = (W - gap * (ds.length + 1)) / ds.length;
        let x = x0 + gap;
        ds.forEach(d => {
          const v = Math.max(0, Number(d[valueKey]) || 0);
          const h = (v / maxVal) * (height - 16);
          const y = baseY - h;
          doc.save().rect(x, y, barW, h).fill(palette.bar).restore();
          doc.fillColor(palette.sub).font('Helvetica').fontSize(8).text(valueFmt ? valueFmt(v) : fmtQ(v), x, y - 12, { width: barW, align: 'center' });
          doc.fillColor(palette.faint).font('Helvetica').fontSize(8).text(String(d[labelKey]).slice(0, 16), x, baseY + 4, { width: barW, align: 'center' });
          x += barW + gap;
        });
        doc.y = baseY + 28;
      };

      const hBarChart = ({ title, data, labelKey, valueKey, height = 10 }) => {
        if (!Array.isArray(data) || !data.length) return;
        ensureSpace(data.length * (height + 10) + 40);
        doc.fillColor(palette.ink).font('Helvetica-Bold').fontSize(11).text(title, PAGE.margin, doc.y, { width: usableWidth() });
        doc.moveDown(0.5);
        const W = usableWidth();
        const maxVal = Math.max(...data.map(d => Number(d[valueKey]) || 0), 1);
        let y = doc.y;
        data.forEach((d) => {
          const v = Number(d[valueKey]) || 0;
          doc.fillColor(palette.sub).font('Helvetica').fontSize(9).text(String(d[labelKey]).slice(0, 24), PAGE.margin, y, { width: 120, align: 'left' });
          const barX = PAGE.margin + 130;
          const barW = (W - 130) * (v / maxVal);
          doc.save().rect(barX, y + 2, barW, height).fill(palette.bar).restore();
          const y0 = doc.y; // guarda para no fluir
          doc.fillColor(palette.faint).font('Helvetica').fontSize(8).text(`${v}%`, barX + barW + 6, y, { width: 40, align: 'left' });
          doc.y = y0; // restaura para evitar salto
          y += height + 8;
        });
        doc.y = y + 4;
      };

      // ==== Header por página ====
      const drawHeader = () => {
        doc.save();
        doc.rect(0, 0, doc.page.width, PAGE.headerH).fill(palette.brand);
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20)
          .text('CINE CONNECT', PAGE.margin, 28, { width: usableWidth(), align: 'center' });
        doc.font('Helvetica-Bold').fontSize(16)
          .text(`REPORTE DE VENTAS - ${String(period).toUpperCase()}`, PAGE.margin, 55, { width: usableWidth(), align: 'center' });
        doc.font('Helvetica').fontSize(9)
          .text(`Generado: ${reportData.metadata.generatedAt}`, PAGE.margin, 80, { width: usableWidth(), align: 'center' })
          .text(`Período: ${reportData.metadata.dateRange.start} - ${reportData.metadata.dateRange.end}`, PAGE.margin, 92, { width: usableWidth(), align: 'center' });
        doc.restore();
        doc.y = 140;
      };
      drawHeader();
      doc.on('pageAdded', drawHeader);

      // ======== CONTENIDO ========

      // Resumen Ejecutivo (KPIs)
      section('RESUMEN EJECUTIVO', 120);
      const stats = [
        { label: 'VENTAS TOTALES', value: fmtQ(reportData.stats.totalSales) },
        { label: 'BOLETOS VENDIDOS', value: fmtInt(reportData.stats.totalTickets) },
        { label: 'PRECIO PROMEDIO', value: fmtQ(reportData.stats.averagePrice) },
        { label: 'PELÍCULAS ACTIVAS', value: String(reportData.stats.activeMovies || 0) }
      ];
      kpiGrid(stats);

      // Top 10 Películas
      if (Array.isArray(reportData.salesByMovie) && reportData.salesByMovie.length) {
        section('TOP 10 PELÍCULAS POR VENTAS', 260);
        const topMovies = reportData.salesByMovie.slice(0, 10).map((m, i) => ({
          idx: `${i + 1}.`,
          title: String(m.movieTitle || '').slice(0, 42),
          sales: fmtQ(m.totalSales || 0),
          tickets: fmtInt(m.ticketCount || 0)
        }));
        table({
          columns: [
            { key: 'idx', header: '#', align: 'left' },
            { key: 'title', header: 'PELÍCULA', align: 'left' },
            { key: 'sales', header: 'VENTAS', align: 'right' },
            { key: 'tickets', header: 'BOLETOS', align: 'right' }
          ],
          rows: topMovies,
          widths: [40, 260, 120, 90]
        });
      }

      // Distribución por género (barras horizontales)
      if (Array.isArray(reportData.genreDistribution) && reportData.genreDistribution.length) {
        section('DISTRIBUCIÓN POR GÉNERO', 180);
        const genres = reportData.genreDistribution.map(g => ({ name: g.name, value: Number(g.value || 0) }));
        hBarChart({ title: 'Participación por género (%)', data: genres, labelKey: 'name', valueKey: 'value', height: 10 });
      }

      // Tendencias diarias (gráfico)
      if (Array.isArray(reportData.dailyTrends) && reportData.dailyTrends.length) {
        section('TENDENCIAS DIARIAS DE VENTAS', 220);
        barChart({
          title: 'Ventas (Q) por día (últimos registros)',
          data: reportData.dailyTrends.map(d => ({ fecha: d.fecha, ventas: d.ventas })),
          labelKey: 'fecha',
          valueKey: 'ventas',
          height: 150,
          maxBars: 14,
          valueFmt: (v) => fmtQ(v)
        });

        // Tabla compacta últimos 7 días
        const recent = reportData.dailyTrends.slice(-7).map(d => ({
          date: d.fecha,
          sales: fmtQ(d.ventas || 0),
          tickets: fmtInt(d.boletos || 0),
          avg: fmtQ((d.boletos ? (d.ventas / d.boletos) : 0))
        }));
        table({
          columns: [
            { key: 'date', header: 'FECHA' },
            { key: 'sales', header: 'VENTAS', align: 'right' },
            { key: 'tickets', header: 'BOLETOS', align: 'right' },
            { key: 'avg', header: 'TICKET PROMEDIO', align: 'right' }
          ],
          rows: recent,
          widths: [120, 120, 120, 150]
        });
      }

      // Métricas adicionales
      section('MÉTRICAS ADICIONALES', 140);
      const totalRevenue = reportData.stats.totalSales || 0;
      const avgRevenuePerMovie = (Array.isArray(reportData.salesByMovie) && reportData.salesByMovie.length)
        ? (totalRevenue / reportData.salesByMovie.length) : 0;
      const topMovieRevenue = (Array.isArray(reportData.salesByMovie) && reportData.salesByMovie.length)
        ? (reportData.salesByMovie[0].totalSales || 0) : 0;
      const topMovieName = (Array.isArray(reportData.salesByMovie) && reportData.salesByMovie.length)
        ? String(reportData.salesByMovie[0].movieTitle || '') : 'N/A';
      const topMoviePct = totalRevenue ? (topMovieRevenue / totalRevenue) * 100 : 0;
      const topGenreName = (Array.isArray(reportData.genreDistribution) && reportData.genreDistribution.length)
        ? String(reportData.genreDistribution[0].name) : 'N/A';
      const highestDay = (() => {
        const d = (reportData.dailyTrends || []).reduce((m, x) => (x.ventas > (m?.ventas ?? -1) ? x : m), null);
        return d ? `${d.fecha} (${fmtQ(d.ventas)})` : 'N/A';
      })();
      const pairs = [
        ['Ingreso promedio por película:', fmtQ(avgRevenuePerMovie)],
        ['Película más taquillera:', topMovieName],
        ['Participación del top 1:', `${topMoviePct.toFixed(1)}% del total`],
        ['Género más popular:', topGenreName],
        ['Día de mayor venta:', highestDay],
        ['Ticket promedio histórico:', fmtQ(reportData.stats.averagePrice || 0)]
      ];
      const colW = (usableWidth() - 20) / 2;
      const startY = doc.y;
      pairs.forEach((p, i) => {
        const col = i % 2, row = Math.floor(i / 2);
        const x = PAGE.margin + col * (colW + 20);
        const y = startY + row * 18;
        ensureSpace(30);
        doc.fillColor(palette.ink).font('Helvetica-Bold').fontSize(9).text(p[0], x, y, { width: colW - 6 });
        doc.fillColor(palette.sub).font('Helvetica').fontSize(9).text(p[1], x + 170, y, { width: colW - 176 });
        doc.y = y + 18;
      });
      doc.y = startY + Math.ceil(pairs.length / 2) * 18 + 10;

      // Análisis
      section('ANÁLISIS Y RECOMENDACIONES', 120);
      const conclusions = (() => {
        const arr = [];
        if (totalRevenue > 50000) arr.push('• Excelente desempeño de ventas: El período muestra ingresos robustos por encima del promedio esperado.');
        else if (totalRevenue > 25000) arr.push('• Buen desempeño de ventas: Los ingresos se mantienen en niveles satisfactorios.');
        else arr.push('• Oportunidad de mejora: Las ventas están por debajo del potencial esperado; revisar estrategias de programación y marketing.');
        if (Array.isArray(reportData.genreDistribution) && reportData.genreDistribution.length) {
          const topG = reportData.genreDistribution[0];
          arr.push(`• El género ${topG.name} lidera con ${topG.value}% de preferencias, señalando una tendencia del público.`);
        }
        if (Array.isArray(reportData.salesByMovie) && reportData.salesByMovie.length) {
          arr.push(`• "${topMovieName}" encabeza la taquilla con ${fmtQ(topMovieRevenue)}.`);
        }
        arr.push('• Recomendación: Mantener un portafolio balanceado aprovechando géneros dominantes mientras se testean nuevas opciones.');
        arr.push('• Próximos pasos: Analizar horarios/salas de mayor rendimiento y ajustar oferta en días de baja demanda.');
        return arr.join('\n');
      })();
      para(conclusions, { align: 'left', fontSize: 10, lineGap: 2 });

      // ==== NUMERAR PIES SIN PÁGINAS FANTASMA ====
      // 1) evitar re-dibujar headers durante pies
      doc.removeListener('pageAdded', drawHeader);

      // 2) footer en dos columnas sin “fluir” el cursor
      const range = doc.bufferedPageRange(); // { start, count }
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const pageNumber = i - range.start + 1;

        const y = doc.page.height - 28;
        const leftW = usableWidth() / 2 - 6;
        const rightW = usableWidth() / 2 - 6;
        const leftX = PAGE.margin;
        const rightX = PAGE.margin + usableWidth() / 2 + 6;

        // línea
        doc.save()
          .moveTo(PAGE.margin, y - 10)
          .lineTo(PAGE.margin + usableWidth(), y - 10)
          .strokeColor(palette.line)
          .lineWidth(1)
          .stroke()
          .restore();

        // Texto izquierdo (guardar/restaurar doc.y para no fluir)
        const y0 = doc.y;
        doc.fillColor(palette.faint).font('Helvetica').fontSize(8)
          .text('Reporte generado automáticamente por Cine Connect Dashboard', leftX, y, { width: leftW, align: 'left' });
        doc.y = y0;

        // Texto derecho
        doc.fillColor(palette.faint).font('Helvetica').fontSize(8)
          .text(`Página ${pageNumber} de ${range.count}`, rightX, y, { width: rightW, align: 'right' });
        // no modificamos doc.y aquí
      }

      // ==== cerrar ====
      doc.end();
      stream.on('finish', () => resolve(`/storage/reports/${filename}`));
      stream.on('error', reject);
    });
  } catch (error) {
    console.error('Error generando reporte PDF:', error);
    throw error;
  }
}



}


module.exports = PDFService;
