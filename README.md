# 🏢 Resource Web Planner

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)

**A sophisticated web-based inventory management solution with collaborative features and intelligent automation**

[🚀 Quick Start](#-quick-start) • [📖 Documentation](#-documentation) • [🎯 Features](#-key-features) • [🏗️ Architecture](#️-architecture) • [📊 Demo](#-demo)

</div>

---

## 📋 Table of Contents

- [🌟 Overview](#-overview)
- [🎯 Key Features](#-key-features)
- [🏗️ Architecture](#️-architecture)
- [🛠️ Technology Stack](#️-technology-stack)
- [🚀 Quick Start](#-quick-start)
- [📖 API Documentation](#-api-documentation)
- [🔧 Configuration](#-configuration)
- [🧪 Testing](#-testing)
- [📊 Screenshots](#-screenshots)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## 🌟 Overview

The **Resource Web Planner** is a comprehensive web application designed to streamline resource tracking, collaborative inventory management, and automated monitoring for organizations of all sizes. Built with modern web technologies and following industry best practices, it provides a robust platform for efficient inventory control.

### 🎖️ Why Choose Our System?

- **🔄 Real-time Collaboration**: Work seamlessly with team members and groups
- **🤖 Intelligent Automation**: Automated low-stock and expiration alerts
- **📊 Advanced Analytics**: Comprehensive reporting and trend analysis
- **🔒 Enterprise Security**: Role-based access control and secure authentication
- **📱 Responsive Design**: Works flawlessly across all devices
- **🔌 Data Integration**: Import/export in JSON, CSV, and XML formats

---

## 🎯 Key Features

<table>
<tr>
<td width="50%">

### 🔐 **Authentication & Security**
- ✅ Secure user registration and login
- ✅ Session-based authentication
- ✅ Role-based access control
- ✅ Password encryption with bcrypt
- ✅ CSRF and XSS protection

### 📦 **Resource Management**
- ✅ Complete CRUD operations
- ✅ Customizable categories with configurable fields
- ✅ Stock level tracking
- ✅ Expiration date monitoring
- ✅ Advanced search and filtering

</td>
<td width="50%">

### 👥 **Group Collaboration**
- ✅ Create and manage groups
- ✅ Shared resource access
- ✅ Member management
- ✅ Group-specific permissions
- ✅ Collaborative inventory tracking

### 🔔 **Smart Notifications**
- ✅ Real-time in-app alerts
- ✅ Email notifications
- ✅ Low stock warnings
- ✅ Expiration reminders
- ✅ Configurable notification preferences

</td>
</tr>
</table>

### 📊 **Advanced Features**

- **📈 Analytics Dashboard**: Comprehensive statistics and trend analysis
- **📥 Data Import/Export**: Support for JSON, CSV, and XML formats
- **🎨 Responsive UI**: Modern, intuitive interface that works on all devices
- **⚡ Background Tasks**: Automated monitoring with configurable intervals
- **🔍 Advanced Search**: Powerful filtering and search capabilities

---

## 🏗️ Architecture

Our system follows the **C4 Model** architecture principles, ensuring scalability, maintainability, and clear separation of concerns.

### 🏛️ **System Architecture Overview**

```mermaid
graph TB
    A[Web Browser] --> B[Node.js Web Server]
    B --> C[PostgreSQL Database]
    B --> D[Email Service]
    B --> E[File System]
    
    subgraph "Application Layers"
        F[Authentication Layer]
        G[Business Logic Layer]
        H[Data Access Layer]
        I[Background Services]
    end
    
    B --> F
    F --> G
    G --> H
    H --> C
    I --> C
    I --> D
```

### 🧩 **Core Components**

- **🌐 HTTP Server**: Handles routing and request processing
- **🔑 Authentication Module**: Manages user sessions and security
- **📦 Resource Controller**: Handles inventory operations
- **👥 Group Management**: Facilitates collaborative features
- **📧 Notification Service**: Manages alerts and communications
- **📊 Analytics Engine**: Generates reports and statistics
- **⏰ Background Tasks**: Automated monitoring and maintenance

---

## 🛠️ Technology Stack

<div align="center">

| Category | Technology | Purpose |
|----------|------------|---------|
| **Backend** | Node.js | Server runtime environment |
| **Database** | PostgreSQL 13+ | Data persistence and relationships |
| **Authentication** | Custom Session-based | Secure user management |
| **Frontend** | Vanilla JavaScript | Dynamic user interface |
| **Styling** | CSS3 | Responsive design |
| **Email** | SMTP | Notification delivery |
| **Architecture** | RESTful API | Clean API design |

</div>

---

## 🚀 Quick Start

### 📋 Prerequisites

- **Node.js** (v14.0.0 or higher)
- **PostgreSQL** (v13.0 or higher)
- **Git**
- **SMTP Server** (for email notifications)

### ⚡ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/inventory-management-system.git
   cd inventory-management-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database and email configuration
   ```

4. **Set up the database**
   ```bash
   # Create PostgreSQL database
   createdb inventory_management
   
   # The application will auto-initialize the schema on first run
   ```

5. **Start the application**
   ```bash
   npm start
   ```

6. **Access the application**
   ```
   Open your browser and navigate to: http://localhost:8087
   ```

### 🔧 Environment Configuration

Create a `.env` file in the root directory:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=inventory_management
DB_USER=your_username
DB_PASSWORD=your_password

# Email Configuration
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_email@example.com
SMTP_PASSWORD=your_email_password

# Application Configuration
PORT=8087
SESSION_SECRET=your_session_secret
NODE_ENV=development
```

---

## 📖 API Documentation

### 🔑 Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/` | User login |
| `POST` | `/register` | User registration |
| `POST` | `/logout` | User logout |

### 📦 Resource Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/resources` | Get all resources |
| `POST` | `/api/resources` | Create new resource |
| `PUT` | `/api/resources/:id` | Update resource |
| `DELETE` | `/api/resources/:id` | Delete resource |
| `POST` | `/api/resources/import` | Import resources |
| `GET` | `/api/resources/export` | Export resources |

### 👥 Group Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/groups` | Get user groups |
| `POST` | `/api/groups` | Create new group |
| `PUT` | `/api/groups/:id` | Update group |
| `POST` | `/api/groups/:id/members` | Add group member |

### 📊 Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/statistics` | Get system statistics |
| `GET` | `/api/statistics/trends` | Get trend analysis |

---

## 🔧 Configuration

### 📁 Project Structure

```
inventory-management-system/
├── 📁 config/
│   └── dbConfig.js          # Database configuration
├── 📁 db/
│   └── init.js              # Database initialization
├── 📁 routes/
│   ├── auth.js              # Authentication routes
│   ├── resources.js         # Resource management
│   ├── categories.js        # Category management
│   ├── users.js             # User management
│   ├── groups.js            # Group management
│   ├── notifications.js     # Notification system
│   └── statistics.js        # Analytics
├── 📁 tasks/
│   ├── expirationChecker.js # Expiration monitoring
│   └── lowStockChecker.js   # Stock monitoring
├── 📁 public/
│   ├── 📁 css/             # Stylesheets
│   └── 📁 js/              # Client-side scripts
├── 📁 views/
│   └── templates.js         # HTML templates
├── 📄 index.js              # Main application file
└── 📄 package.json          # Dependencies
```

### ⚙️ Background Tasks Configuration

The system includes automated monitoring tasks:

- **Expiration Checker**: Runs every 24 hours to check for expiring resources
- **Low Stock Checker**: Monitors inventory levels and sends alerts
- **Session Cleanup**: Removes expired user sessions

---

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm run test:auth
npm run test:resources
npm run test:groups

# Run with coverage
npm run test:coverage
```

### Test Categories

- **Unit Tests**: Individual component testing
- **Integration Tests**: API endpoint testing
- **Security Tests**: Authentication and authorization
- **Performance Tests**: Load and stress testing

---

## 📊 Screenshots

<div align="center">

### 🏠 Dashboard Overview
![Dashboard](https://via.placeholder.com/800x400/2c3e50/ffffff?text=Dashboard+Overview)

### 📦 Resource Management
![Resources](https://via.placeholder.com/800x400/3498db/ffffff?text=Resource+Management)

### 👥 Group Collaboration
![Groups](https://via.placeholder.com/800x400/27ae60/ffffff?text=Group+Collaboration)

### 📊 Analytics Dashboard
![Analytics](https://via.placeholder.com/800x400/e74c3c/ffffff?text=Analytics+Dashboard)

</div>

---

## 🚀 Deployment

### 🐳 Docker Deployment

```dockerfile
# Dockerfile example
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 8087
CMD ["npm", "start"]
```

### ☁️ Cloud Deployment Options

- **Heroku**: Easy deployment with PostgreSQL add-on
- **AWS**: EC2 + RDS for production environments
- **DigitalOcean**: Droplets with managed PostgreSQL
- **Azure**: App Service + Azure Database for PostgreSQL

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### 🔄 Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### 📋 Code Standards

- Follow ESLint configuration
- Maintain test coverage above 80%
- Document all public APIs
- Use meaningful commit messages

---

## 📈 Roadmap

- [ ] **Mobile App**: React Native companion app
- [ ] **Advanced Analytics**: Machine learning insights
- [ ] **API v2**: GraphQL implementation
- [ ] **Multi-tenant**: Enterprise multi-organization support
- [ ] **Barcode Scanning**: Mobile barcode integration
- [ ] **Blockchain**: Supply chain tracking

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **IEEE Standards**: Following IEEE 830-1998 SRS guidelines
- **C4 Model**: Architecture documentation methodology
- **PostgreSQL Team**: For the excellent database system
- **Node.js Community**: For the robust runtime environment

---

<div align="center">

**Made with ❤️ by [Your Name](https://github.com/yourusername)**

[![GitHub stars](https://img.shields.io/github/stars/yourusername/inventory-management-system?style=social)](https://github.com/yourusername/inventory-management-system/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/yourusername/inventory-management-system?style=social)](https://github.com/yourusername/inventory-management-system/network)
[![GitHub issues](https://img.shields.io/github/issues/yourusername/inventory-management-system)](https://github.com/yourusername/inventory-management-system/issues)

⭐ **Star this repository if you found it helpful!** ⭐

</div>