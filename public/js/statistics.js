document.addEventListener('DOMContentLoaded', function() {
  const loadingElement = document.getElementById('loading');
  const generatePdfBtn = document.getElementById('generatePdfBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  
  // Chart objects to make them accessible globally within this file
  let categoryChart = null;
  let stockChart = null;
  let quantityChart = null;
  
  // Color palette for charts
  const colorPalette = [
    '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b',
    '#6610f2', '#6f42c1', '#fd7e14', '#20c9a6', '#8e4b8b'
  ];
  
  // Function to fetch all resources data
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
  
  // Function to fetch all categories
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
  
  // Function to create the resources by category chart
  async function createCategoryChart(resources, categories) {
    // Get the context of the canvas element
    const ctx = document.getElementById('category-chart').getContext('2d');
    
    // Create a map of category_id to category name
    const categoryMap = {};
    categories.forEach(category => {
      categoryMap[category.id] = category.name;
    });
    
    // Count resources by category
    const resourcesByCategory = {};
    resources.forEach(resource => {
      const categoryName = categoryMap[resource.category_id] || 'Unknown';
      if (!resourcesByCategory[categoryName]) {
        resourcesByCategory[categoryName] = 0;
      }
      resourcesByCategory[categoryName]++;
    });
    
    // Extract data for chart
    const labels = Object.keys(resourcesByCategory);
    const data = Object.values(resourcesByCategory);
    
    // If a chart already exists, destroy it before creating a new one
    if (categoryChart) {
      categoryChart.destroy();
    }
    
    // Create the chart
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
  
  // Function to create the stock status chart
  function createStockChart(resources) {
    const ctx = document.getElementById('stock-chart').getContext('2d');
    
    // Count low stock resources
    const lowStockCount = resources.filter(r => 
      r.quantity !== null && r.low_stock_threshold !== null && r.quantity <= r.low_stock_threshold
    ).length;
    
    const normalStockCount = resources.length - lowStockCount;
    
    // If a chart already exists, destroy it before creating a new one
    if (stockChart) {
      stockChart.destroy();
    }
    
    // Create the chart
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
  
  // Function to create the quantity distribution chart
  function createQuantityChart(resources) {
    const ctx = document.getElementById('quantity-chart').getContext('2d');
    
    // Define quantity ranges
    const ranges = [
      { label: '0', min: 0, max: 0 },
      { label: '1-10', min: 1, max: 10 },
      { label: '11-50', min: 11, max: 50 },
      { label: '51-100', min: 51, max: 100 },
      { label: '101-500', min: 101, max: 500 },
      { label: '500+', min: 501, max: Infinity }
    ];
    
    // Count resources in each range
    const countsByRange = ranges.map(range => {
      return resources.filter(r => {
        const quantity = r.quantity !== null ? r.quantity : 0;
        return quantity >= range.min && quantity <= range.max;
      }).length;
    });
    
    // If a chart already exists, destroy it before creating a new one
    if (quantityChart) {
      quantityChart.destroy();
    }
    
    // Create the chart
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
  
  // Function to fetch statistics data from the backend
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
  
  // Function to initialize all charts
  async function initializeCharts() {
    try {
      loadingElement.style.display = 'block';

      // Option 1: Use the dedicated statistics API
      const statsData = await fetchStatisticsData();
      
      if (statsData) {
        // Use direct statistics endpoint data if available
        const resources = await fetchResourcesData();
        const categories = await fetchCategories();
        
        // Create the charts using the fetched data
        const categoryData = await createCategoryChart(resources, categories);
        const stockData = createStockChart(resources);
        const quantityData = createQuantityChart(resources);
        
        return {
          resources,
          categories,
          charts: { categoryData, stockData, quantityData }
        };
      } else {
        // Fallback to the original implementation
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
  
  // Function to generate PDF report
  function generatePDF() {
    loadingElement.style.display = 'block';
    
    // Import jsPDF from the CDN
    const { jsPDF } = window.jspdf;
    
    // Create a new PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Add title
    doc.setFontSize(22);
    doc.text('Resource Statistics Report', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 30, { align: 'center' });
    
    // Current y position for progressive adding content
    let yPos = 40;
    
    // Process each chart
    const processChart = (chartId, title, callback) => {
      // Get the chart canvas
      const canvas = document.getElementById(chartId);
      
      // Convert the canvas to data URL
      const imageData = canvas.toDataURL('image/png');
      
      // Add chart title
      doc.setFontSize(16);
      doc.text(title, 105, yPos, { align: 'center' });
      yPos += 10;
      
      // Add the chart image
      doc.addImage(imageData, 'PNG', 20, yPos, 170, 80);
      yPos += 90;
      
      if (callback) callback();
    };
    
    // Use html2canvas and Promise to handle the asynchronous conversion
    html2canvas(document.getElementById('category-chart')).then(canvas => {
      const imageData = canvas.toDataURL('image/png');
      doc.setFontSize(16);
      doc.text('Resources by Category', 105, yPos, { align: 'center' });
      yPos += 10;
      doc.addImage(imageData, 'PNG', 20, yPos, 170, 80);
      yPos += 90;
      
      // Process the next chart
      html2canvas(document.getElementById('stock-chart')).then(canvas => {
        const imageData = canvas.toDataURL('image/png');
        doc.setFontSize(16);
        doc.text('Stock Status', 105, yPos, { align: 'center' });
        yPos += 10;
        doc.addImage(imageData, 'PNG', 20, yPos, 170, 80);
        yPos += 90;
        
        // Process the last chart
        html2canvas(document.getElementById('quantity-chart')).then(canvas => {
          const imageData = canvas.toDataURL('image/png');
          
          // Add a new page if needed
          if (yPos > 240) {
            doc.addPage();
            yPos = 20;
          }
          
          doc.setFontSize(16);
          doc.text('Quantity Distribution', 105, yPos, { align: 'center' });
          yPos += 10;
          doc.addImage(imageData, 'PNG', 20, yPos, 170, 80);
          
          // Save the PDF
          doc.save('resource-statistics-report.pdf');
          loadingElement.style.display = 'none';
        });
      });
    });
  }
  
  // Set up event listeners
  generatePdfBtn.addEventListener('click', generatePDF);
  refreshBtn.addEventListener('click', initializeCharts);
  
  // Initialize charts when page loads
  initializeCharts();
});
