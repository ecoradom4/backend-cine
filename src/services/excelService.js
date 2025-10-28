const ExcelJS = require('exceljs');

class ExcelService {
  static async generateSalesReport(reportData, period) {
    const workbook = new ExcelJS.Workbook();
    
    // Estilos reutilizables
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFF' }, size: 12 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '1a365d' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' }
      }
    };

    const titleStyle = {
      font: { bold: true, size: 16, color: { argb: '1a365d' } },
      alignment: { horizontal: 'center' }
    };

    const subtitleStyle = {
      font: { bold: true, size: 14, color: { argb: '2d3748' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'f7fafc' } }
    };

    const moneyStyle = {
      numFmt: '"Q"#,##0.00'
    };

    const percentageStyle = {
      numFmt: '0.0"%"'
    };

    const boldStyle = {
      font: { bold: true }
    };

    // Hoja de Resumen Ejecutivo
    const summarySheet = workbook.addWorksheet('Resumen Ejecutivo');

    // Título principal
    summarySheet.mergeCells('A1:H1');
    summarySheet.getCell('A1').value = `CINE CONNECT - REPORTE DE VENTAS - ${period.toUpperCase()}`;
    summarySheet.getCell('A1').style = titleStyle;

    // Metadatos
    summarySheet.getCell('A3').value = 'Generado:';
    summarySheet.getCell('B3').value = reportData.metadata.generatedAt;
    summarySheet.getCell('A4').value = 'Período:';
    summarySheet.getCell('B4').value = reportData.metadata.period;
    summarySheet.getCell('A5').value = 'Rango de fechas:';
    summarySheet.getCell('B5').value = `${reportData.metadata.dateRange.start} - ${reportData.metadata.dateRange.end}`;

    // RESUMEN EJECUTIVO - Estadísticas principales
    summarySheet.mergeCells('A7:H7');
    summarySheet.getCell('A7').value = 'RESUMEN EJECUTIVO';
    summarySheet.getCell('A7').style = subtitleStyle;

    // Tarjetas de estadísticas en formato de cuadrícula
    const statsCards = [
      { label: 'VENTAS TOTALES', value: reportData.stats.totalSales, format: moneyStyle, details: 'Ingresos brutos' },
      { label: 'BOLETOS VENDIDOS', value: reportData.stats.totalTickets, format: { numFmt: '#,##0' }, details: 'Total de entradas' },
      { label: 'PRECIO PROMEDIO', value: reportData.stats.averagePrice, format: moneyStyle, details: 'Por boleto' },
      { label: 'PELÍCULAS ACTIVAS', value: reportData.stats.activeMovies, format: { numFmt: '0' }, details: 'En cartelera' }
    ];

    statsCards.forEach((card, index) => {
      const row = 9 + Math.floor(index / 2) * 3;
      const col = (index % 2) * 4 + 1;

      // Encabezado de tarjeta
      summarySheet.mergeCells(row, col, row, col + 2);
      summarySheet.getCell(row, col).value = card.label;
      summarySheet.getCell(row, col).style = headerStyle;

      // Valor principal
      summarySheet.mergeCells(row + 1, col, row + 1, col + 2);
      summarySheet.getCell(row + 1, col).value = card.value;
      summarySheet.getCell(row + 1, col).style = { 
        font: { bold: true, size: 14, color: { argb: '1a365d' } },
        alignment: { horizontal: 'center' },
        ...card.format
      };

      // Detalles
      summarySheet.mergeCells(row + 2, col, row + 2, col + 2);
      summarySheet.getCell(row + 2, col).value = card.details;
      summarySheet.getCell(row + 2, col).style = {
        font: { size: 10, color: { argb: '718096' } },
        alignment: { horizontal: 'center' },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'f8f9fa' } }
      };
    });

    // MÉTRICAS ADICIONALES
    const metricsStartRow = 16;
    summarySheet.mergeCells(`A${metricsStartRow}:H${metricsStartRow}`);
    summarySheet.getCell(`A${metricsStartRow}`).value = 'MÉTRICAS ADICIONALES';
    summarySheet.getCell(`A${metricsStartRow}`).style = subtitleStyle;

    // Calcular métricas adicionales
    const totalRevenue = reportData.stats.totalSales;
    const avgRevenuePerMovie = reportData.salesByMovie.length > 0 ? 
      totalRevenue / reportData.salesByMovie.length : 0;
    const topMovieRevenue = reportData.salesByMovie.length > 0 ? 
      reportData.salesByMovie[0].totalSales : 0;
    const topMoviePercentage = totalRevenue > 0 ? 
      (topMovieRevenue / totalRevenue) * 100 : 0;
    
    const highestSalesDay = this.getHighestSalesDay(reportData.dailyTrends);
    const topGenre = reportData.genreDistribution.length > 0 ? 
      reportData.genreDistribution[0] : null;

    const additionalMetrics = [
      ['Ingreso promedio por película:', avgRevenuePerMovie, moneyStyle],
      ['Película más taquillera:', reportData.salesByMovie.length > 0 ? reportData.salesByMovie[0].movieTitle : 'N/A', {}],
      ['Participación del top 1:', topMoviePercentage, percentageStyle],
      ['Género más popular:', topGenre ? topGenre.name : 'N/A', {}],
      ['Día de mayor venta:', highestSalesDay, {}],
      ['Eficiencia de ventas:', reportData.stats.totalTickets > 0 ? totalRevenue / reportData.stats.totalTickets : 0, moneyStyle],
      ['Películas con ventas:', reportData.salesByMovie.length, { numFmt: '0' }],
      ['Géneros representados:', reportData.genreDistribution.length, { numFmt: '0' }]
    ];

    additionalMetrics.forEach((metric, index) => {
      const row = metricsStartRow + 2 + index;
      summarySheet.getCell(`A${row}`).value = metric[0];
      summarySheet.getCell(`A${row}`).style = boldStyle;
      
      summarySheet.getCell(`B${row}`).value = metric[1];
      if (metric[2]) {
        summarySheet.getCell(`B${row}`).style = metric[2];
      }
    });

    // ANÁLISIS Y RECOMENDACIONES
    const analysisStartRow = metricsStartRow + additionalMetrics.length + 4;
    summarySheet.mergeCells(`A${analysisStartRow}:H${analysisStartRow}`);
    summarySheet.getCell(`A${analysisStartRow}`).value = 'ANÁLISIS Y RECOMENDACIONES';
    summarySheet.getCell(`A${analysisStartRow}`).style = subtitleStyle;

    const conclusions = this.generateConclusions(reportData);
    conclusions.forEach((conclusion, index) => {
      summarySheet.getCell(`A${analysisStartRow + 2 + index}`).value = conclusion;
      summarySheet.mergeCells(`A${analysisStartRow + 2 + index}:H${analysisStartRow + 2 + index}`);
    });

    // Hoja de Ventas por Película (MEJORADA)
    const moviesSheet = workbook.addWorksheet('Ventas por Película');
    
    moviesSheet.mergeCells('A1:F1');
    moviesSheet.getCell('A1').value = 'ANÁLISIS DETALLADO POR PELÍCULA';
    moviesSheet.getCell('A1').style = titleStyle;

    // Estadísticas resumen de películas
    moviesSheet.getCell('A3').value = 'Total de películas con ventas:';
    moviesSheet.getCell('B3').value = reportData.salesByMovie.length;
    moviesSheet.getCell('A4').value = 'Ventas promedio por película:';
    moviesSheet.getCell('B4').value = avgRevenuePerMovie;
    moviesSheet.getCell('B4').style = moneyStyle;

    // Encabezados de tabla
    const movieHeaders = [
      'Posición', 'Película', 'Ventas (Q)', 
      'Boletos', 'Ticket Promedio', 'Participación %'
    ];
    
    movieHeaders.forEach((header, index) => {
      moviesSheet.getCell(6, index + 1).value = header;
      moviesSheet.getCell(6, index + 1).style = headerStyle;
    });

    // Datos de películas
    reportData.salesByMovie.forEach((movie, index) => {
      const row = index + 7;
      const participation = totalRevenue > 0 ? (movie.totalSales / totalRevenue) * 100 : 0;
      
      moviesSheet.getCell(row, 1).value = index + 1;
      moviesSheet.getCell(row, 2).value = movie.movieTitle;
      moviesSheet.getCell(row, 3).value = movie.totalSales;
      moviesSheet.getCell(row, 3).style = moneyStyle;
      moviesSheet.getCell(row, 4).value = movie.ticketCount;
      moviesSheet.getCell(row, 5).value = movie.ticketCount > 0 ? movie.totalSales / movie.ticketCount : 0;
      moviesSheet.getCell(row, 5).style = moneyStyle;
      moviesSheet.getCell(row, 6).value = participation / 100; // Dividir por 100 para formato porcentaje
      moviesSheet.getCell(row, 6).style = percentageStyle;

      // Colorear filas alternas para mejor lectura
      if (index % 2 === 0) {
        for (let col = 1; col <= 6; col++) {
          moviesSheet.getCell(row, col).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'f8f9fa' }
          };
        }
      }
    });

    // Agregar totales
    const totalRow = reportData.salesByMovie.length + 7;
    moviesSheet.getCell(totalRow, 2).value = 'TOTALES';
    moviesSheet.getCell(totalRow, 2).style = boldStyle;
    moviesSheet.getCell(totalRow, 3).value = totalRevenue;
    moviesSheet.getCell(totalRow, 3).style = { ...moneyStyle, ...boldStyle };
    moviesSheet.getCell(totalRow, 4).value = reportData.stats.totalTickets;
    moviesSheet.getCell(totalRow, 4).style = boldStyle;
    moviesSheet.getCell(totalRow, 6).value = 1; // 100%
    moviesSheet.getCell(totalRow, 6).style = { ...percentageStyle, ...boldStyle };

    // Hoja de Tendencias Diarias (MEJORADA)
    const trendsSheet = workbook.addWorksheet('Tendencias Diarias');
    
    trendsSheet.mergeCells('A1:E1');
    trendsSheet.getCell('A1').value = 'TENDENCIAS DIARIAS DE VENTAS';
    trendsSheet.getCell('A1').style = titleStyle;

    // Análisis de tendencias
    trendsSheet.getCell('A3').value = 'Período analizado:';
    trendsSheet.getCell('B3').value = `${reportData.dailyTrends.length} días`;
    trendsSheet.getCell('A4').value = 'Día de mayor venta:';
    trendsSheet.getCell('B4').value = highestSalesDay;

    const trendsHeaders = [
      'Fecha', 'Ventas (Q)', 'Boletos Vendidos', 
      'Ticket Promedio', 'Día de Semana'
    ];
    
    trendsHeaders.forEach((header, index) => {
      trendsSheet.getCell(6, index + 1).value = header;
      trendsSheet.getCell(6, index + 1).style = headerStyle;
    });

    reportData.dailyTrends.forEach((trend, index) => {
      const row = index + 7;
      const ticketAverage = trend.boletos > 0 ? trend.ventas / trend.boletos : 0;
      const dayOfWeek = this.getDayOfWeek(trend.fullDate);
      
      trendsSheet.getCell(row, 1).value = trend.fecha;
      trendsSheet.getCell(row, 2).value = trend.ventas;
      trendsSheet.getCell(row, 2).style = moneyStyle;
      trendsSheet.getCell(row, 3).value = trend.boletos;
      trendsSheet.getCell(row, 4).value = ticketAverage;
      trendsSheet.getCell(row, 4).style = moneyStyle;
      trendsSheet.getCell(row, 5).value = dayOfWeek;

      // Destacar día de mayor venta
      if (trend.ventas === Math.max(...reportData.dailyTrends.map(t => t.ventas))) {
        for (let col = 1; col <= 5; col++) {
          trendsSheet.getCell(row, col).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'fff3cd' }
          };
        }
      }
    });

    // Hoja de Distribución por Género (MEJORADA)
    const genreSheet = workbook.addWorksheet('Distribución por Género');
    
    genreSheet.mergeCells('A1:D1');
    genreSheet.getCell('A1').value = 'DISTRIBUCIÓN POR GÉNERO';
    genreSheet.getCell('A1').style = titleStyle;

    // Resumen de distribución
    genreSheet.getCell('A3').value = 'Género principal:';
    genreSheet.getCell('B3').value = topGenre ? topGenre.name : 'N/A';
    genreSheet.getCell('A4').value = 'Participación:';
    genreSheet.getCell('B4').value = topGenre ? topGenre.value / 100 : 0;
    genreSheet.getCell('B4').style = percentageStyle;
    genreSheet.getCell('A5').value = 'Total de géneros:';
    genreSheet.getCell('B5').value = reportData.genreDistribution.length;

    const genreHeaders = [
      'Género', 'Porcentaje (%)', 'Distribución', 'Clasificación'
    ];
    
    genreHeaders.forEach((header, index) => {
      genreSheet.getCell(7, index + 1).value = header;
      genreSheet.getCell(7, index + 1).style = headerStyle;
    });

    reportData.genreDistribution.forEach((genre, index) => {
      const row = index + 8;
      let classification = '';
      if (genre.value >= 20) classification = 'Alta demanda';
      else if (genre.value >= 10) classification = 'Demanda media';
      else classification = 'Demanda baja';

      genreSheet.getCell(row, 1).value = genre.name;
      genreSheet.getCell(row, 2).value = genre.value / 100; // Dividir por 100 para formato porcentaje
      genreSheet.getCell(row, 2).style = percentageStyle;
      genreSheet.getCell(row, 3).value = this.generateProgressBar(genre.value);
      genreSheet.getCell(row, 4).value = classification;

      // Colorear según clasificación
      if (classification === 'Alta demanda') {
        genreSheet.getCell(row, 4).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'd4edda' }
        };
      } else if (classification === 'Demanda media') {
        genreSheet.getCell(row, 4).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'fff3cd' }
        };
      }
    });

    // Hoja de Análisis Comparativo (NUEVA)
    const analysisSheet = workbook.addWorksheet('Análisis Comparativo');
    
    analysisSheet.mergeCells('A1:C1');
    analysisSheet.getCell('A1').value = 'ANÁLISIS COMPARATIVO';
    analysisSheet.getCell('A1').style = titleStyle;

    // Comparativa Top 5 vs Resto
    const top5Sales = reportData.salesByMovie.slice(0, 5).reduce((sum, movie) => sum + movie.totalSales, 0);
    const restSales = totalRevenue - top5Sales;
    const top5Percentage = totalRevenue > 0 ? (top5Sales / totalRevenue) * 100 : 0;

    analysisSheet.getCell('A3').value = 'COMPARATIVA TOP 5 vs RESTO';
    analysisSheet.getCell('A3').style = subtitleStyle;

    const comparisonData = [
      ['Categoría', 'Ventas (Q)', 'Participación'],
      ['Top 5 Películas', top5Sales, top5Percentage / 100],
      ['Resto de Películas', restSales, (100 - top5Percentage) / 100],
      ['TOTAL', totalRevenue, 1]
    ];

    comparisonData.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        const cellRef = analysisSheet.getCell(4 + rowIndex, 1 + colIndex);
        cellRef.value = cell;
        
        if (rowIndex === 0) {
          cellRef.style = headerStyle;
        } else {
          if (colIndex === 1) cellRef.style = moneyStyle;
          if (colIndex === 2) cellRef.style = percentageStyle;
          if (rowIndex === comparisonData.length - 1) cellRef.style = boldStyle;
        }
      });
    });

    // Ajustar anchos de columnas
    const sheets = [summarySheet, moviesSheet, trendsSheet, genreSheet, analysisSheet];
    sheets.forEach(sheet => {
      sheet.columns.forEach(column => {
        column.width = column.width || 18;
      });
    });

    // Congelar paneles para mejor navegación
    moviesSheet.views = [{ state: 'frozen', ySplit: 6 }];
    trendsSheet.views = [{ state: 'frozen', ySplit: 6 }];
    genreSheet.views = [{ state: 'frozen', ySplit: 7 }];

    // Generar buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }

  // Métodos auxiliares
  static getHighestSalesDay(dailyTrends) {
    if (!dailyTrends || dailyTrends.length === 0) return 'N/A';
    
    const highest = dailyTrends.reduce((max, day) => 
      day.ventas > max.ventas ? day : max
    );
    
    return `${highest.fecha} (Q${highest.ventas.toLocaleString('es-GT')})`;
  }

  static getDayOfWeek(dateString) {
    const date = new Date(dateString);
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return days[date.getDay()];
  }

  static generateProgressBar(percentage) {
    const bars = Math.round(percentage / 5); // Cada 5% = una barra
    return '█'.repeat(bars) + '░'.repeat(20 - bars);
  }

  static generateConclusions(reportData) {
    const conclusions = [];
    
    // Análisis de ventas totales
    if (reportData.stats.totalSales > 50000) {
      conclusions.push('• EXCELENTE DESEMPEÑO: Ventas por encima del promedio esperado con ingresos robustos.');
    } else if (reportData.stats.totalSales > 25000) {
      conclusions.push('• BUEN DESEMPEÑO: Ventas en niveles satisfactorios con oportunidad de crecimiento.');
    } else {
      conclusions.push('• OPORTUNIDAD DE MEJORA: Recomendado revisar estrategias de marketing y programación.');
    }

    // Análisis de distribución
    if (reportData.genreDistribution.length > 0) {
      const topGenre = reportData.genreDistribution[0];
      conclusions.push(`• TENDENCIA DE GÉNERO: ${topGenre.name} lidera con ${topGenre.value}% de preferencia del público.`);
    }

    // Análisis de películas
    if (reportData.salesByMovie.length > 0) {
      const topMovie = reportData.salesByMovie[0];
      conclusions.push(`• PELÍCULA ESTRELLA: "${topMovie.movieTitle}" genera Q${topMovie.totalSales.toLocaleString('es-GT')} (${((topMovie.totalSales/reportData.stats.totalSales)*100).toFixed(1)}% del total).`);
    }

    // Recomendaciones estratégicas
    conclusions.push('• RECOMENDACIÓN: Mantener programación balanceada capitalizando géneros populares.');
    conclusions.push('• PRÓXIMOS PASOS: Analizar horarios y salas de alto rendimiento para optimizar programación.');
    conclusions.push('• OPORTUNIDAD: Explorar promociones para géneros con menor participación.');

    return conclusions;
  }
}

module.exports = ExcelService;