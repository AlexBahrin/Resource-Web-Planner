document.addEventListener('DOMContentLoaded', function() {
  const loadingElement = document.getElementById('loading');
  const generatePdfBtn = document.getElementById('generatePdfBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  
  let categoryChart = null;
  let stockChart = null;
  let quantityChart = null;
  
  const colorPalette = [
    '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b',
    '#6610f2', '#6f42c1', '#fd7e14', '#20c9a6', '#8e4b8b'
  ];
  
  async function fetchResourcesData() {
    try {
      loadingElement.style.display = 'block';
      const response = await fetch('/api/resources');
      
      if (!response.ok) {
        throw new Error(`Error fetching resources: ${response.statusText}`);
      }
      
      const resources = await response.json();
      return resources;
    } catch (error) {
      console.error('Failed to fetch resources:', error);
      alert('Failed to load resources data. Please try again.');
      return [];
    } finally {
      loadingElement.style.display = 'none';
    }
  }
  
  async function fetchCategories() {
    try {
      const response = await fetch('/api/categories');
      
      if (!response.ok) {
        throw new Error(`Error fetching categories: ${response.statusText}`);
      }
      
      const categories = await response.json();
      return categories;
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      return [];
    }
  }
  
  async function createCategoryChart(resources, categories) {
    const ctx = document.getElementById('category-chart').getContext('2d');
    
    const categoryMap = {};
    categories.forEach(category => {
      categoryMap[category.id] = category.name;
    });
    
    const resourcesByCategory = {};
    resources.forEach(resource => {
      const categoryName = categoryMap[resource.category_id] || 'Unknown';
      if (!resourcesByCategory[categoryName]) {
        resourcesByCategory[categoryName] = 0;
      }
      resourcesByCategory[categoryName]++;
    });
    
    const labels = Object.keys(resourcesByCategory);
    const data = Object.values(resourcesByCategory);
    
    if (categoryChart) {
      categoryChart.destroy();
    }
    
    categoryChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Number of Resources',
          data: data,
          backgroundColor: labels.map((_, i) => colorPalette[i % colorPalette.length]),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Resources by Category'
          },
          legend: {
            display: false
          }
        }
      }
    });
    
    return { labels, data };
  }
  
  function createStockChart(resources) {
    const ctx = document.getElementById('stock-chart').getContext('2d');
    
    const lowStockCount = resources.filter(r =>
      r.quantity !== null && r.low_stock_threshold !== null && r.quantity <= r.low_stock_threshold
    ).length;
    
    const normalStockCount = resources.length - lowStockCount;
    
    if (stockChart) {
      stockChart.destroy();
    }
    
    stockChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Normal Stock', 'Low Stock'],
        datasets: [{
          data: [normalStockCount, lowStockCount],
          backgroundColor: ['#1cc88a', '#e74a3b'],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Stock Status'
          }
        }
      }
    });
    
    return {
      labels: ['Normal Stock', 'Low Stock'],
      data: [normalStockCount, lowStockCount]
    };
  }
  
  function createQuantityChart(resources) {
    const ctx = document.getElementById('quantity-chart').getContext('2d');
    
    const ranges = [
      { label: '0', min: 0, max: 0 },
      { label: '1-10', min: 1, max: 10 },
      { label: '11-50', min: 11, max: 50 },
      { label: '51-100', min: 51, max: 100 },
      { label: '101-500', min: 101, max: 500 },
      { label: '500+', min: 501, max: Infinity }
    ];
    
    const countsByRange = ranges.map(range => {
      return resources.filter(r => {
        const quantity = r.quantity !== null ? r.quantity : 0;
        return quantity >= range.min && quantity <= range.max;
      }).length;
    });
    
    if (quantityChart) {
      quantityChart.destroy();
    }
    
    quantityChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ranges.map(r => r.label),
        datasets: [{
          label: 'Number of Resources',
          data: countsByRange,
          backgroundColor: colorPalette,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Distribution by Quantity'
          },
          legend: {
            display: false
          }
        }
      }
    });
    
    return {
      labels: ranges.map(r => r.label),
      data: countsByRange
    };
  }
  
  async function fetchStatisticsData() {
    try {
      loadingElement.style.display = 'block';
      const response = await fetch('/api/statistics/summary');
      
      if (!response.ok) {
        throw new Error(`Error fetching statistics: ${response.statusText}`);
      }
      
      const statsData = await response.json();
      return statsData;
    } catch (error) {
      console.error('Failed to fetch statistics data:', error);
      alert('Failed to load statistics data. Please try again.');
      return null;
    } finally {
      loadingElement.style.display = 'none';
    }
  }
  
  async function initializeCharts() {
    try {
      loadingElement.style.display = 'block';

      const statsData = await fetchStatisticsData();
      
      if (statsData) {
        const resources = await fetchResourcesData();
        const categories = await fetchCategories();
        
        const categoryData = await createCategoryChart(resources, categories);
        const stockData = createStockChart(resources);
        const quantityData = createQuantityChart(resources);
        
        return {
          resources,
          categories,
          charts: { categoryData, stockData, quantityData }
        };
      } else {
        const resources = await fetchResourcesData();
        const categories = await fetchCategories();
        
        const categoryData = await createCategoryChart(resources, categories);
        const stockData = createStockChart(resources);
        const quantityData = createQuantityChart(resources);
        
        return {
          resources,
          categories,
          charts: { categoryData, stockData, quantityData }
        };
      }
    } catch (error) {
      console.error('Error initializing charts:', error);
      alert('Failed to initialize charts. Please try again.');
    } finally {
      loadingElement.style.display = 'none';
    }
  }
  
  function generatePDF() {
    loadingElement.style.display = 'block';
    
    const { jsPDF } = window.jspdf;
    
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    doc.setFontSize(22);
    doc.text('Resource Statistics Report', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 30, { align: 'center' });
    
    let yPos = 40;
    
    const processChart = (chartId, title, callback) => {
      const canvas = document.getElementById(chartId);
      
      const imageData = canvas.toDataURL('image/png');
      
      doc.setFontSize(16);
      doc.text(title, 105, yPos, { align: 'center' });
      yPos += 10;
      
      doc.addImage(imageData, 'PNG', 20, yPos, 170, 80);
      yPos += 90;
      
      if (callback) callback();
    };
    
    html2canvas(document.getElementById('category-chart')).then(canvas => {
      const imageData = canvas.toDataURL('image/png');
      doc.setFontSize(16);
      doc.text('Resources by Category', 105, yPos, { align: 'center' });
      yPos += 10;
      doc.addImage(imageData, 'PNG', 20, yPos, 170, 80);
      yPos += 90;
      
      html2canvas(document.getElementById('stock-chart')).then(canvas => {
        const imageData = canvas.toDataURL('image/png');
        doc.setFontSize(16);
        doc.text('Stock Status', 105, yPos, { align: 'center' });
        yPos += 10;
        doc.addImage(imageData, 'PNG', 20, yPos, 170, 80);
        yPos += 90;
        
        html2canvas(document.getElementById('quantity-chart')).then(canvas => {
          const imageData = canvas.toDataURL('image/png');
          
          if (yPos > 240) {
            doc.addPage();
            yPos = 20;
          }
          
          doc.setFontSize(16);
          doc.text('Quantity Distribution', 105, yPos, { align: 'center' });
          yPos += 10;
          doc.addImage(imageData, 'PNG', 20, yPos, 170, 80);
          
          doc.save('resource-statistics-report.pdf');
          loadingElement.style.display = 'none';
        });
      });
    });
  }
  
  generatePdfBtn.addEventListener('click', generatePDF);
  refreshBtn.addEventListener('click', initializeCharts);
  
  initializeCharts();
});
