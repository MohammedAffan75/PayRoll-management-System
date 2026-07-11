import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const DEPARTMENTS = ['Engineering', 'HR', 'Finance', 'Marketing', 'Sales', 'Operations', 'IT', 'Administration'];
const LEAVE_TYPES = ['annual', 'sick', 'casual', 'maternity', 'paternity', 'bereavement', 'unpaid'];
const GENDER_OPTIONS = ['male', 'female', 'other'];

// --- PDF Helper ---
const makePDF = (title, subtitle, rows, filename) => {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header bar
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageW, 14, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYROLLPRO', 14, 9);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), pageW - 14, 9, { align: 'right' });

  y = 28;
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, y);
  y += 7;
  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(subtitle, 14, y);
    y += 8;
  }

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, y, pageW - 14, y);
  y += 8;

  // Rows
  rows.forEach(row => {
    if (row === null) { y += 4; return; }
    if (row.type === 'section') {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFillColor(241, 245, 249);
      doc.rect(14, y - 4, pageW - 28, 8, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text(row.label.toUpperCase(), 16, y + 1);
      y += 10;
      return;
    }
    if (y > 275) { doc.addPage(); y = 20; }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(String(row.label), 18, y);
    doc.setFont('helvetica', 'bold');
    const valColor = row.color || 'default';
    if (valColor === 'green') doc.setTextColor(5, 150, 105);
    else if (valColor === 'red') doc.setTextColor(220, 38, 38);
    else doc.setTextColor(15, 23, 42);
    doc.text(String(row.value), pageW - 18, y, { align: 'right' });
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.3);
    doc.line(18, y + 2, pageW - 18, y + 2);
    y += 9;
  });

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 285, pageW, 12, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('This is a computer-generated document. For queries, contact HR.', 14, 292);
    doc.text(`Page ${i} of ${pageCount}`, pageW - 14, 292, { align: 'right' });
  }

  doc.save(filename);
};

// --- Setup Axios Interceptor ---
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, (error) => Promise.reject(error));

// --- Shared Components ---
const Card = ({ children, className = "" }) => (
  <div className={`bg-white/80 backdrop-blur-sm border border-white/60 rounded-2xl shadow-sm shadow-slate-200/50 ${className}`}>{children}</div>
);

const Badge = ({ children, color = "blue" }) => {
  const colors = {
    blue: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    green: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    red: "bg-red-50 text-red-700 ring-1 ring-red-200",
    purple: "bg-purple-50 text-purple-700 ring-1 ring-purple-200",
    yellow: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    amber: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  };
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors[color] || colors.blue}`}>{children}</span>;
};

// Count-up animation hook
const useCountUp = (target, duration = 1200) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (typeof target !== 'number') return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
};

const StatCard = ({ title, value, icon, color, trend, prefix = '' }) => {
  const numVal = typeof value === 'number' ? value : null;
  const animated = useCountUp(numVal || 0);
  const colorMap = {
    blue:   { bg: 'from-blue-500 to-blue-600',   light: 'bg-blue-50',   text: 'text-blue-600',   ring: 'ring-blue-100' },
    emerald:{ bg: 'from-emerald-500 to-teal-500', light: 'bg-emerald-50',text: 'text-emerald-600',ring: 'ring-emerald-100' },
    amber:  { bg: 'from-amber-400 to-orange-500', light: 'bg-amber-50',  text: 'text-amber-600',  ring: 'ring-amber-100' },
    indigo: { bg: 'from-indigo-500 to-purple-600',light: 'bg-indigo-50', text: 'text-indigo-600', ring: 'ring-indigo-100' },
  };
  const c = colorMap[color] || colorMap.blue;
  return (
    <motion.div
      whileHover={{ y: -3, boxShadow: '0 20px 40px rgba(0,0,0,0.08)' }}
      className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm cursor-default transition-all"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.bg} flex items-center justify-center text-white text-xl shadow-lg`}>
          {icon}
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-bold px-2 py-1 rounded-lg ${trend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
      <p className="text-3xl font-black text-slate-800 tracking-tight">
        {numVal !== null ? `${prefix}${animated.toLocaleString()}` : value}
      </p>
    </motion.div>
  );
};

// --- Landing Page ---
const LandingPage = ({ onGetStarted }) => {
  const features = [
    { icon: '💰', title: 'Payroll Processing', desc: 'Automate salary calculations, deductions, and disbursements with precision and speed.' },
    { icon: '👥', title: 'Employee Management', desc: 'Centralized employee profiles, roles, departments, and lifecycle management.' },
    { icon: '📅', title: 'Leave Management', desc: 'Streamlined leave requests, approvals, and balance tracking for every employee.' },
    { icon: '⏱️', title: 'Attendance Tracking', desc: 'Real-time check-in/check-out with monthly summaries and attendance analytics.' },
    { icon: '📈', title: 'Reports & Analytics', desc: 'Comprehensive payroll, attendance, and leave reports with one-click downloads.' },
    { icon: '🏢', title: 'Department Insights', desc: 'Department-wise headcount, budget allocation, and performance visibility.' },
  ];

  const stats = [
    { value: '99.9%', label: 'Uptime Guaranteed' },
    { value: '< 1s', label: 'Processing Speed' },
    { value: '256-bit', label: 'Data Encryption' },
    { value: '24/7', label: 'System Availability' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white overflow-x-hidden">
      {/* Animated background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-[40%] left-[40%] w-[300px] h-[300px] bg-cyan-500/10 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Navbar */}
      <motion.nav
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-20 flex items-center justify-between px-8 py-5 border-b border-white/5 backdrop-blur-md bg-white/5"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center font-black text-sm">P</div>
          <span className="text-xl font-black tracking-tight">PAYROLL<span className="text-blue-400">PRO</span></span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#stats" className="hover:text-white transition-colors">Why Us</a>
          <a href="#how" className="hover:text-white transition-colors">How It Works</a>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
          onClick={onGetStarted}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/40"
        >
          Sign In
        </motion.button>
      </motion.nav>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center justify-center text-center px-6 pt-28 pb-24">
        <motion.div
          aria-hidden
          animate={{ rotate: 360 }}
          transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
          className="absolute top-24 w-[420px] h-[420px] rounded-full border border-white/10"
        />
        <motion.div
          aria-hidden
          animate={{ scale: [1, 1.08, 1], opacity: [0.15, 0.35, 0.15] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-28 w-[300px] h-[300px] rounded-full bg-white/10 blur-3xl"
        />
        {[
          { label: 'Auto Payroll', left: '12%', top: '18%', delay: 0 },
          { label: 'Smart Leaves', left: '76%', top: '28%', delay: 0.6 },
          { label: 'Live Attendance', left: '14%', top: '42%', delay: 1.1 },
        ].map((chip) => (
          <motion.div
            key={chip.label}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.45, 1, 0.45], y: [0, -10, 0] }}
            transition={{ duration: 5, delay: chip.delay, repeat: Infinity, ease: 'easeInOut' }}
            className="hidden md:block absolute px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-[11px] font-semibold text-slate-200 backdrop-blur-sm"
            style={{ left: chip.left, top: chip.top }}
          >
            {chip.label}
          </motion.div>
        ))}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <span className="inline-block px-4 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-full text-blue-400 text-xs font-bold uppercase tracking-widest mb-6">
            Enterprise Payroll Platform
          </span>
          <h1 className="text-5xl md:text-7xl font-black leading-tight mb-6 bg-gradient-to-br from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Payroll Made<br />
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Effortless.</span>
          </h1>
          <motion.div
            aria-hidden
            animate={{ x: ['-120%', '120%'] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'linear' }}
            className="h-px max-w-sm mx-auto mb-6 bg-gradient-to-r from-transparent via-white/70 to-transparent"
          />
          <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            A complete HR & payroll management system — automate salaries, track attendance, manage leaves, and generate reports all in one place.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(59,130,246,0.4)' }}
              whileTap={{ scale: 0.97 }}
              onClick={onGetStarted}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold text-lg shadow-2xl shadow-blue-900/50 transition-all"
            >
              Get Started →
            </motion.button>
            <motion.a
              whileHover={{ scale: 1.03 }}
              href="#features"
              className="px-8 py-4 border border-white/10 bg-white/5 backdrop-blur-sm text-white rounded-2xl font-bold text-lg hover:bg-white/10 transition-all"
            >
              Explore Features
            </motion.a>
          </div>
        </motion.div>
        <motion.a
          href="#features"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: [0.35, 1, 0.35], y: [0, 6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="mt-10 text-xs uppercase tracking-[0.2em] text-slate-400 hover:text-white transition-colors"
        >
          Scroll to explore ↓
        </motion.a>

        {/* Floating dashboard preview */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.5 }}
          className="mt-20 w-full max-w-4xl mx-auto"
        >
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <div className="w-3 h-3 rounded-full bg-green-500/70" />
              <div className="flex-1 mx-4 h-6 bg-white/5 rounded-lg" />
            </div>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {['Total Employees', 'Monthly Payroll', 'Pending Leaves', 'Attendance'].map((label, i) => (
                <div key={i} className="bg-white/5 rounded-xl p-3 border border-white/5">
                  <div className="text-xs text-slate-500 mb-1">{label}</div>
                  <div className="text-lg font-black text-white">{['48', '₹12.4L', '3', '94%'][i]}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 bg-white/5 rounded-xl p-4 border border-white/5 h-24 flex items-end gap-1">
                {[40, 65, 50, 80, 70, 90, 75].map((h, i) => (
                  <div key={i} className="flex-1 bg-blue-500/60 rounded-sm" style={{ height: `${h}%` }} />
                ))}
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/5 h-24 flex flex-col justify-between">
                <div className="text-xs text-slate-500">Departments</div>
                {['Engineering', 'HR', 'Finance'].map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    <span className="text-xs text-slate-400">{d}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Stats */}
      <section id="stats" className="relative z-10 py-16 border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <div className="text-4xl font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent mb-1">{s.value}</div>
              <div className="text-sm text-slate-500 font-medium">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-black mb-4">Everything You Need</h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">One platform to manage your entire workforce — from hire to payslip.</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ y: -4, boxShadow: '0 20px 60px rgba(59,130,246,0.15)' }}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm transition-all cursor-default"
              >
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="relative z-10 py-24 px-6 bg-white/[0.02] border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-4xl font-black mb-4">Up & Running in Minutes</h2>
            <p className="text-slate-400 text-lg mb-16">Simple, intuitive, and powerful — no training required.</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Sign In', desc: 'Securely log in with your admin or employee credentials.' },
              { step: '02', title: 'Configure', desc: 'Set up departments, employees, and salary structures in minutes.' },
              { step: '03', title: 'Automate', desc: 'Process payroll, approve leaves, and generate reports instantly.' },
            ].map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative"
              >
                <div className="text-6xl font-black text-white/5 mb-2">{s.step}</div>
                <h3 className="text-xl font-bold mb-2">{s.title}</h3>
                <p className="text-slate-400 text-sm">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-24 px-6 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}>
          <div className="max-w-2xl mx-auto bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/20 rounded-3xl p-12 backdrop-blur-sm">
            <h2 className="text-4xl font-black mb-4">Ready to Get Started?</h2>
            <p className="text-slate-400 mb-8">Sign in to your PayrollPro dashboard and take control of your workforce today.</p>
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: '0 0 50px rgba(59,130,246,0.5)' }}
              whileTap={{ scale: 0.97 }}
              onClick={onGetStarted}
              className="px-10 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold text-lg shadow-2xl transition-all"
            >
              Launch Dashboard →
            </motion.button>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-8 px-6 text-center text-slate-600 text-sm">
        © {new Date().getFullYear()} PayrollPro. Enterprise Payroll Management System.
      </footer>
    </div>
  );
};

// --- Login Component ---
const Login = ({ setAuth, onBack }) => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('username', form.email);
      formData.append('password', form.password);
      const res = await axios.post(`${API_URL}/auth/login`, formData);
      localStorage.setItem('token', res.data.access_token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setAuth(true);
    } catch (err) {
      setError('Invalid email or password. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e] relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] bg-indigo-600/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />

      {/* Back button */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onBack}
        className="absolute top-6 left-6 flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium z-20"
      >
        ← Back to Home
      </motion.button>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md mx-6"
      >
        {/* Card */}
        <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-10 shadow-2xl">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center font-black text-white">P</div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">PAYROLL<span className="text-blue-400">PRO</span></h1>
              <p className="text-slate-500 text-xs">Enterprise Management System</p>
            </div>
          </div>

          <h2 className="text-2xl font-black text-white mb-1">Welcome back</h2>
          <p className="text-slate-400 text-sm mb-8">Sign in to access your dashboard</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email</label>
              <input
                type="email"
                placeholder="you@company.com"
                className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                required
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                required
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(59,130,246,0.4)' }}
              whileTap={{ scale: 0.98 }}
              disabled={loading}
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-base shadow-lg shadow-blue-900/40 hover:from-blue-500 hover:to-indigo-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Authenticating...
                </span>
              ) : 'Sign In →'}
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

// --- Main Layout with Sidebar ---
const Layout = ({ role, user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);

  const adminLinks = [
    { id: 'dashboard', label: 'Dashboard',   icon: '▦',  emoji: '📊' },
    { id: 'employees', label: 'Employees',   icon: '◉',  emoji: '👥' },
    { id: 'payroll',   label: 'Payroll',     icon: '◈',  emoji: '💰' },
    { id: 'leaves',    label: 'Leaves',      icon: '◷',  emoji: '📅' },
    { id: 'reports',   label: 'Reports',     icon: '◎',  emoji: '📈' },
    { id: 'departments',label:'Departments', icon: '⬡',  emoji: '🏢' },
  ];
  const employeeLinks = [
    { id: 'dashboard', label: 'My Portal',   icon: '▦',  emoji: '🏠' },
    { id: 'mysalary',  label: 'My Salary',   icon: '◈',  emoji: '💸' },
    { id: 'myleaves',  label: 'My Leaves',   icon: '◷',  emoji: '📅' },
    { id: 'attendance',label: 'Attendance',  icon: '◉',  emoji: '⏱️' },
  ];
  const links = role === 'admin' ? adminLinks : employeeLinks;

  const pageTitles = {
    dashboard: role === 'admin' ? 'Dashboard Overview' : 'My Portal',
    employees: 'Employee Management', payroll: 'Payroll Management',
    leaves: 'Leave Management', reports: 'Reports & Analytics',
    departments: 'Departments', mysalary: 'My Salary',
    myleaves: 'My Leaves', attendance: 'Attendance',
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="w-64 flex-shrink-0 flex flex-col h-screen sticky top-0 z-30"
            style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 100%)' }}
          >
            {/* Logo */}
            <div className="px-6 py-5 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-lg shadow-blue-900/50">P</div>
                <div>
                  <h1 className="text-base font-black tracking-tight text-white">PAYROLL<span className="text-blue-400">PRO</span></h1>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">{role} Panel</p>
                </div>
              </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-3 mb-3">Navigation</p>
              {links.map(link => (
                <motion.button
                  key={link.id}
                  whileHover={{ x: 3 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveTab(link.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                    activeTab === link.id
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/40'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all ${
                    activeTab === link.id ? 'bg-white/20' : 'bg-white/5 group-hover:bg-white/10'
                  }`}>{link.emoji}</span>
                  <span className="font-semibold text-sm">{link.label}</span>
                  {activeTab === link.id && (
                    <motion.div layoutId="activeIndicator" className="ml-auto w-1.5 h-1.5 rounded-full bg-white/70" />
                  )}
                </motion.button>
              ))}
            </nav>

            {/* User card */}
            <div className="px-3 py-4 border-t border-white/5">
              <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/5 hover:bg-white/8 transition-all">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0">
                  {user.first_name?.[0]}{user.last_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{user.first_name} {user.last_name}</p>
                  <p className="text-[10px] text-slate-500 capitalize">{role}</p>
                </div>
                <button onClick={onLogout} title="Sign out" className="text-slate-500 hover:text-red-400 transition-colors text-sm">⏻</button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Top Navbar */}
        <header className="bg-white/70 backdrop-blur-xl border-b border-slate-200/60 px-6 py-3.5 flex items-center justify-between flex-shrink-0 sticky top-0 z-20 shadow-sm shadow-slate-100">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-all"
            >
              ☰
            </button>
            <div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight">{pageTitles[activeTab]}</h2>
              <p className="text-xs text-slate-400">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-xl text-sm text-slate-400 w-48 hover:bg-slate-200 transition-all cursor-text">
              <span>🔍</span>
              <span>Search...</span>
            </div>
            {/* Status pill */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs font-bold text-emerald-700">Live</span>
            </div>
            {/* Avatar */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen(v => !v)}
                className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center font-bold text-white text-sm shadow-md hover:shadow-lg transition-all"
              >
                {user.first_name?.[0]}{user.last_name?.[0]}
              </button>
              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50"
                  >
                    <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-100">
                      <p className="font-bold text-slate-800 text-sm">{user.first_name} {user.last_name}</p>
                      <p className="text-xs text-slate-500 capitalize">{role}</p>
                    </div>
                    <button onClick={onLogout} className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 font-medium transition-all flex items-center gap-2">
                      <span>⏻</span> Sign Out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {activeTab === 'dashboard' && (role === 'admin' ? <AdminOverview /> : <EmployeeOverview />)}
              {activeTab === 'employees' && role === 'admin' && <AdminEmployees />}
              {activeTab === 'payroll' && role === 'admin' && <AdminPayroll />}
              {activeTab === 'leaves' && role === 'admin' && <AdminLeaves />}
              {activeTab === 'reports' && role === 'admin' && <AdminReports />}
              {activeTab === 'departments' && role === 'admin' && <AdminDepartments />}
              {activeTab === 'mysalary' && role !== 'admin' && <EmployeeSalary />}
              {activeTab === 'myleaves' && role !== 'admin' && <EmployeeLeaves />}
              {activeTab === 'attendance' && role !== 'admin' && <EmployeeAttendance />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

// --- Admin Overview ---
const AdminOverview = () => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    axios.get(`${API_URL}/dashboard/stats`).then(res => setStats(res.data));
  }, []);

  // Skeleton loader
  if (!stats) return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-slate-200 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 bg-slate-200 rounded-2xl" />
        <div className="h-64 bg-slate-200 rounded-2xl" />
      </div>
    </div>
  );

  const barColors = ['bg-blue-500','bg-indigo-500','bg-violet-500','bg-purple-500','bg-fuchsia-500','bg-pink-500'];
  const maxDept = Math.max(...(stats.department_distribution?.map(d => d.count) || [1]));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Employees" value={stats.overview?.total_employees} icon="👥" color="blue" trend={4} />
        <StatCard title="Active Employees" value={stats.overview?.active_employees} icon="✅" color="emerald" trend={2} />
        <StatCard title="Pending Leaves" value={stats.overview?.pending_leaves} icon="⏳" color="amber" />
        <StatCard title="Monthly Payroll" value={stats.overview?.current_month_payroll} icon="💰" color="indigo" prefix="₹" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Payroll trend bar chart */}
        <Card className="lg:col-span-3 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-slate-800">Payroll Trend</h3>
              <p className="text-xs text-slate-400 mt-0.5">Last 6 months</p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 bg-blue-50 text-blue-600 rounded-lg">Monthly</span>
          </div>
          <div className="flex items-end gap-2 h-40">
            {stats.monthly_payroll_trend?.map((m, i) => {
              const maxVal = Math.max(...stats.monthly_payroll_trend.map(x => x.total || 0), 1);
              const pct = ((m.total || 0) / maxVal) * 100;
              return (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(pct, 4)}%` }}
                  transition={{ delay: i * 0.08, duration: 0.5, ease: 'easeOut' }}
                  className="flex-1 bg-gradient-to-t from-blue-600 to-indigo-400 rounded-t-lg relative group cursor-default"
                  style={{ minHeight: '4px' }}
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap z-10">
                    ₹{(m.total || 0).toLocaleString()}
                  </div>
                </motion.div>
              );
            })}
          </div>
          <div className="flex gap-2 mt-2">
            {stats.monthly_payroll_trend?.map((m, i) => (
              <div key={i} className="flex-1 text-center text-[10px] text-slate-400 font-medium truncate">{m.month?.split(' ')[0]}</div>
            ))}
          </div>
        </Card>

        {/* Department distribution */}
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-slate-800">Departments</h3>
              <p className="text-xs text-slate-400 mt-0.5">Headcount</p>
            </div>
          </div>
          <div className="space-y-3">
            {stats.department_distribution?.slice(0, 6).map((dept, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${barColors[i % barColors.length]}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-medium text-slate-600 truncate">{dept.name}</span>
                    <span className="text-xs font-bold text-slate-800 ml-2">{dept.count}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(dept.count / maxDept) * 100}%` }}
                      transition={{ delay: i * 0.07, duration: 0.6, ease: 'easeOut' }}
                      className={`h-full rounded-full ${barColors[i % barColors.length]}`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent payroll */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-slate-800">Recent Payroll</h3>
            <Badge color="green">Latest</Badge>
          </div>
          <div className="space-y-3">
            {stats.recent_payroll?.length ? stats.recent_payroll.map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center text-sm font-bold text-blue-700">
                    {p.employee_name?.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{p.employee_name}</p>
                    <p className="text-xs text-slate-400">{p.processed_at ? new Date(p.processed_at).toLocaleDateString() : '-'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-600">₹{p.net_salary?.toLocaleString()}</p>
                  <Badge color="green">Paid</Badge>
                </div>
              </motion.div>
            )) : <p className="text-sm text-slate-400 text-center py-6">No payroll records yet</p>}
          </div>
        </Card>

        {/* Upcoming leaves */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-slate-800">Upcoming Leaves</h3>
            <Badge color="amber">Next 30 days</Badge>
          </div>
          <div className="space-y-3">
            {stats.upcoming_leaves?.length ? stats.upcoming_leaves.map((l, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center text-sm">📅</div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{l.employee_name}</p>
                    <p className="text-xs text-slate-400">{new Date(l.start_date).toLocaleDateString()} — {new Date(l.end_date).toLocaleDateString()}</p>
                  </div>
                </div>
                <Badge color="yellow">{l.days}d</Badge>
              </motion.div>
            )) : <p className="text-sm text-slate-400 text-center py-6">No upcoming leaves</p>}
          </div>
        </Card>
      </div>
    </div>
  );
};

// --- (StatCard defined above in shared components) ---

// --- Admin Employees Management ---
const AdminEmployees = () => {
  const [employees, setEmployees] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    axios.get(`${API_URL}/employees/`).then(res => setEmployees(res.data));
  }, []);

  const handleEditEmployee = (employee) => {
    setSelectedEmployee(employee);
    setEditForm({
      first_name: employee.first_name,
      last_name: employee.last_name,
      phone: employee.phone,
      department: employee.department,
      designation: employee.designation,
      gender: employee.gender || 'other',
      role: employee.role,
      is_active: employee.is_active
    });
    setShowEditModal(true);
  };

  const handleUpdateEmployee = async () => {
    try {
      await axios.put(`${API_URL}/employees/${selectedEmployee.id}`, editForm);
      // Refresh the employees list
      axios.get(`${API_URL}/employees/`).then(res => setEmployees(res.data));
      setShowEditModal(false);
      setSelectedEmployee(null);
      setEditForm({});
      alert('Employee updated successfully!');
    } catch (err) {
      alert('Failed to update employee: ' + (err.response?.data?.detail || 'Unknown error'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-slate-800">Manage Workforce</h3>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all">
          + Add New Employee
        </button>
      </div>
      
      <Card>
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Employee</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Contact</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Department</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.map(emp => (
              <tr key={emp.id} className="hover:bg-slate-50/50 transition-all">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center font-bold text-slate-600">
                      {emp.first_name[0]}{emp.last_name[0]}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{emp.first_name} {emp.last_name}</p>
                      <p className="text-xs text-slate-500">{emp.designation}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm text-slate-700">{emp.email}</p>
                  <p className="text-xs text-slate-500">{emp.phone}</p>
                </td>
                <td className="px-6 py-4">
                  <Badge color="blue">{emp.department}</Badge>
                </td>
                <td className="px-6 py-4">
                  <Badge color={emp.is_active ? "green" : "red"}>{emp.is_active ? "Active" : "Disabled"}</Badge>
                </td>
                <td className="px-6 py-4">
                  <button onClick={() => handleEditEmployee(emp)} className="text-blue-600 font-bold text-sm hover:underline mr-3">Edit</button>
                  <button onClick={() => { setSelectedEmployee(emp); setShowSalaryModal(true); }} className="text-emerald-600 font-bold text-sm hover:underline">Set Salary</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      
      <AddEmployeeModal isOpen={showAdd} onClose={() => setShowAdd(false)} onAdded={() => axios.get(`${API_URL}/employees/`).then(res => setEmployees(res.data))} />

      {showSalaryModal && selectedEmployee && (
        <SetSalaryModal
          employee={selectedEmployee}
          onClose={() => { setShowSalaryModal(false); setSelectedEmployee(null); }}
          onSaved={() => {}}
        />
      )}

      {/* Edit Employee Modal */}
      {showEditModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">Edit Employee</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">First Name</label>
                <input
                  type="text"
                  value={editForm.first_name || ''}
                  onChange={(e) => setEditForm({...editForm, first_name: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Last Name</label>
                <input
                  type="text"
                  value={editForm.last_name || ''}
                  onChange={(e) => setEditForm({...editForm, last_name: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
                <input
                  type="tel"
                  value={editForm.phone || ''}
                  onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Department</label>
                <select
                  value={editForm.department || ''}
                  onChange={(e) => setEditForm({...editForm, department: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Engineering">Engineering</option>
                  <option value="HR">HR</option>
                  <option value="Finance">Finance</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Sales">Sales</option>
                  <option value="Operations">Operations</option>
                  <option value="IT">IT</option>
                  <option value="Administration">Administration</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Designation</label>
                <input
                  type="text"
                  value={editForm.designation || ''}
                  onChange={(e) => setEditForm({...editForm, designation: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Gender</label>
                <select
                  value={editForm.gender || 'other'}
                  onChange={(e) => setEditForm({...editForm, gender: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {GENDER_OPTIONS.map((gender) => (
                    <option key={gender} value={gender}>{gender.charAt(0).toUpperCase() + gender.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Role</label>
                <select
                  value={editForm.role || ''}
                  onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                  <option value="hr_manager">HR Manager</option>
                  <option value="finance">Finance</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                <select
                  value={editForm.is_active ? "true" : "false"}
                  onChange={(e) => setEditForm({...editForm, is_active: e.target.value === "true"})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="true">Active</option>
                  <option value="false">Disabled</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Email (Read-only)</label>
                <input
                  type="email"
                  value={selectedEmployee?.email || ''}
                  disabled
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500"
                  readOnly
                />
                <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
              </div>
            </div>
            
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleUpdateEmployee}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all"
              >
                Update Employee
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg font-medium hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Employee Overview Portal ---
const EmployeeOverview = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState(null);

  useEffect(() => {
    axios.get(`${API_URL}/dashboard/stats`).then(res => setStats(res.data));
    // Check today's attendance status
    const today = new Date().toISOString().split('T')[0];
    axios.get(`${API_URL}/employee/me/attendance?start_date=${today}&end_date=${today}`)
      .then(res => setTodayAttendance(res.data[0] || null))
      .catch(() => setTodayAttendance(null));
  }, []);

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_URL}/attendance/my/check-in`);
      // Refresh stats and attendance after check-in
      axios.get(`${API_URL}/dashboard/stats`).then(res => setStats(res.data));
      const today = new Date().toISOString().split('T')[0];
      axios.get(`${API_URL}/employee/me/attendance?start_date=${today}&end_date=${today}`)
        .then(res => setTodayAttendance(res.data[0] || null));
      alert('Checked in successfully!');
    } catch (err) {
      if (err.response?.data?.detail === 'Already checked in today') {
        // Refresh attendance status and show message
        const today = new Date().toISOString().split('T')[0];
        axios.get(`${API_URL}/employee/me/attendance?start_date=${today}&end_date=${today}`)
          .then(res => setTodayAttendance(res.data[0] || null));
        alert('You are already checked in today!');
      } else {
        alert('Check-in failed: ' + (err.response?.data?.detail || 'Unknown error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleViewSchedule = () => {
    const scheduleHTML = `
      <html>
        <head>
          <title>Work Schedule</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
            .company { font-size: 24px; font-weight: bold; color: #333; }
            .title { font-size: 18px; color: #666; margin: 5px 0; }
            .schedule { margin: 20px 0; }
            .day-row { display: flex; border-bottom: 1px solid #ddd; padding: 10px 0; }
            .day-row:hover { background-color: #f5f5f5; }
            .day-name { font-weight: bold; width: 120px; color: #333; }
            .day-date { width: 100px; color: #666; }
            .day-status { flex: 1; text-align: center; }
            .working { color: #28a745; font-weight: bold; }
            .weekend { color: #dc3545; font-weight: bold; }
            .holiday { color: #ffc107; font-weight: bold; }
            .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; }
            .legend { margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 5px; }
            .legend-item { display: inline-block; margin: 0 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company">PAYROLLPRO</div>
            <div class="title">Work Schedule</div>
            <div class="period">${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
          </div>
          
          <div class="legend">
            <strong>Legend:</strong><br>
            <span class="legend-item"><span class="working">● Working Day</span></span>
            <span class="legend-item"><span class="weekend">● Weekend</span></span>
            <span class="legend-item"><span class="holiday">● Holiday</span></span>
          </div>
          
          <div class="schedule">
            <div class="day-row">
              <div class="day-name">Monday</div>
              <div class="day-date">9:00 AM - 6:00 PM</div>
              <div class="day-status working">Working Day</div>
            </div>
            <div class="day-row">
              <div class="day-name">Tuesday</div>
              <div class="day-date">9:00 AM - 6:00 PM</div>
              <div class="day-status working">Working Day</div>
            </div>
            <div class="day-row">
              <div class="day-name">Wednesday</div>
              <div class="day-date">9:00 AM - 6:00 PM</div>
              <div class="day-status working">Working Day</div>
            </div>
            <div class="day-row">
              <div class="day-name">Thursday</div>
              <div class="day-date">9:00 AM - 6:00 PM</div>
              <div class="day-status working">Working Day</div>
            </div>
            <div class="day-row">
              <div class="day-name">Friday</div>
              <div class="day-date">9:00 AM - 6:00 PM</div>
              <div class="day-status working">Working Day</div>
            </div>
            <div class="day-row">
              <div class="day-name">Saturday</div>
              <div class="day-date">-</div>
              <div class="day-status weekend">Weekend</div>
            </div>
            <div class="day-row">
              <div class="day-name">Sunday</div>
              <div class="day-date">-</div>
              <div class="day-status weekend">Weekend</div>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Office Hours:</strong> Monday - Friday, 9:00 AM - 6:00 PM</p>
            <p><strong>Lunch Break:</strong> 1:00 PM - 2:00 PM</p>
            <p><strong>Contact HR:</strong> For any schedule changes or requests</p>
          </div>
        </body>
      </html>
    `;
    
    const newWindow = window.open('', '_blank');
    newWindow.document.write(scheduleHTML);
    newWindow.document.close();
  };

  if (!stats) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="space-y-8">
      <Card className="p-8 bg-gradient-to-br from-blue-600 to-indigo-700 text-white overflow-hidden relative">
        <div className="relative z-10">
          <h3 className="text-3xl font-bold mb-2">Hello, {stats.employee?.name}!</h3>
          <p className="text-blue-100 opacity-90">Everything looks great today. You've completed {stats.summary?.attendance_this_month} attendance logs this month.</p>
          <div className="mt-8 flex gap-4">
            {todayAttendance?.check_in_time ? (
              <div className="px-6 py-2 bg-emerald-500 text-white rounded-xl font-bold">
                ✓ Checked In at {new Date(todayAttendance.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
            ) : (
              <button onClick={handleCheckIn} disabled={loading} className="px-6 py-2 bg-white text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition-all disabled:opacity-50">
                {loading ? 'Checking In...' : 'Check In Now'}
              </button>
            )}
            <button onClick={handleViewSchedule} className="px-6 py-2 bg-blue-500/30 border border-blue-400/30 rounded-xl font-bold backdrop-blur-sm hover:bg-blue-500/40 transition-all">
              View Schedule
            </button>
          </div>
        </div>
        <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="p-6">
          <h4 className="font-bold text-slate-800 mb-4">My Leave Balance</h4>
          <div className="space-y-4 text-center py-4">
            <div className="w-24 h-24 rounded-full border-8 border-emerald-500 border-t-slate-100 mx-auto flex items-center justify-center">
              <span className="text-2xl font-bold text-slate-800">12</span>
            </div>
            <p className="text-sm font-medium text-slate-500">Annual Leaves Remaining</p>
          </div>
        </Card>

        <Card className="p-6 col-span-2">
          <h4 className="font-bold text-slate-800 mb-4">Quick Summary</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Last Payout</p>
              <p className="text-xl font-bold text-slate-800">₹{stats.recent_payroll?.[0]?.net_salary?.toLocaleString() || '0'}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Leaves Status</p>
              <p className="text-xl font-bold text-amber-600">{stats.summary?.pending_leave_requests} Pending</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

// --- Modal: Add Employee ---
const AddEmployeeModal = ({ isOpen, onClose, onAdded }) => {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', department: 'Engineering', designation: '', gender: 'other', date_of_joining: '', password: '', role: 'employee' });
  const [loading, setLoading] = useState(false);
  
  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_URL}/auth/register`, form);
      onAdded();
      onClose();
    } catch (err) { alert('Registration Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-2xl w-full max-w-xl shadow-2xl overflow-y-auto max-h-[90vh]">
        <h2 className="text-2xl font-bold mb-6">New Team Member</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <input placeholder="First Name" className="p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 outline-none" required onChange={e => setForm({ ...form, first_name: e.target.value })} />
          <input placeholder="Last Name" className="p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 outline-none" required onChange={e => setForm({ ...form, last_name: e.target.value })} />
          <input placeholder="Email" type="email" className="p-3 border border-slate-200 rounded-xl col-span-2 focus:ring-2 focus:ring-blue-400 outline-none" required onChange={e => setForm({ ...form, email: e.target.value })} />
          <select className="p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 outline-none" onChange={e => setForm({ ...form, department: e.target.value })}>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <input placeholder="Designation" className="p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 outline-none" required onChange={e => setForm({ ...form, designation: e.target.value })} />
          <select className="p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 outline-none" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
            {GENDER_OPTIONS.map(gender => <option key={gender} value={gender}>{gender.charAt(0).toUpperCase() + gender.slice(1)}</option>)}
          </select>
          <input type="date" className="p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 outline-none" required onChange={e => setForm({ ...form, date_of_joining: e.target.value })} />
          <input placeholder="Phone" className="p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 outline-none" onChange={e => setForm({ ...form, phone: e.target.value })} />
          <input placeholder="Initial Password" type="password" className="p-3 border border-slate-200 rounded-xl col-span-2 focus:ring-2 focus:ring-blue-400 outline-none" required onChange={e => setForm({ ...form, password: e.target.value })} />
          <div className="flex gap-4 col-span-2 mt-4">
            <button type="button" onClick={onClose} className="flex-1 py-3 font-bold text-slate-600">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200">
              {loading ? 'Adding...' : 'Add Employee'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// --- Modal: Apply Leave ---
const ApplyLeaveModal = ({ onClose, onApply, userGender }) => {
  const [form, setForm] = useState({ leave_type: 'annual', start_date: '', end_date: '', reason: '' });
  const [loading, setLoading] = useState(false);
  const normalizedGender = (userGender || 'other').toLowerCase();
  const availableLeaveTypes = LEAVE_TYPES.filter((type) => {
    if (type === 'maternity') return normalizedGender === 'female';
    if (type === 'paternity') return normalizedGender === 'male';
    return true;
  });

  useEffect(() => {
    if (!availableLeaveTypes.includes(form.leave_type)) {
      setForm((prev) => ({ ...prev, leave_type: availableLeaveTypes[0] || 'annual' }));
    }
  }, [availableLeaveTypes, form.leave_type]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onApply(form);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-2xl w-full max-w-md shadow-2xl">
        <h2 className="text-2xl font-bold mb-6">Apply for Leave</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Leave Type</label>
            <select className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 outline-none" value={form.leave_type} onChange={e => setForm({ ...form, leave_type: e.target.value })}>
              {availableLeaveTypes.map(type => (
                <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Start Date</label>
            <input type="date" className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 outline-none" required value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">End Date</label>
            <input type="date" className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 outline-none" required value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} min={form.start_date} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Reason</label>
            <textarea className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 outline-none" rows="3" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Optional: Provide reason for leave"></textarea>
          </div>
          <div className="flex gap-2 mt-6">
            <button type="button" onClick={onClose} className="flex-1 py-3 border border-slate-200 rounded-xl font-bold">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold">
              {loading ? 'Applying...' : 'Apply Leave'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// --- Empty Placeholder Components for other tabs ---
// --- Admin Payroll Management ---
const AdminPayroll = () => {
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  useEffect(() => {
    fetchPayrollRecords();
    fetchEmployees();
  }, []);

  const fetchPayrollRecords = async () => {
    try {
      const res = await axios.get(`${API_URL}/payroll/`);
      setPayrollRecords(res.data);
    } catch (err) {
      console.error('Failed to fetch payroll records:', err);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(`${API_URL}/employees/`);
      setEmployees(res.data);
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    }
  };

  const handleProcessPayroll = async (data) => {
    try {
      await axios.post(`${API_URL}/payroll/process`, data);
      fetchPayrollRecords();
      setShowProcessModal(false);
    } catch (err) {
      const detail = err.response?.data?.detail || 'Unknown error';
      if (detail.toLowerCase().includes('salary structure')) {
        alert('⚠️ Salary structure not defined for this employee.\n\nPlease go to the Employees tab, select the employee, and set up their salary structure before processing payroll.');
      } else {
        alert('Payroll processing failed: ' + detail);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-slate-800">Payroll Management</h3>
        <button onClick={() => setShowProcessModal(true)} className="px-4 py-2 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-all">
          Process Payroll
        </button>
      </div>
      
      <Card>
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Employee</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Period</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Gross Salary</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Deductions</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Net Salary</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payrollRecords.map(record => (
              <tr key={record.id} className="hover:bg-slate-50/50 transition-all">
                <td className="px-6 py-4">
                  <p className="font-bold text-slate-800">{record.employee_name || 'Employee ' + record.employee_id}</p>
                  <p className="text-xs text-slate-500">ID: {record.employee_id}</p>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm text-slate-700">{new Date(record.year, record.month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</p>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm font-bold text-slate-800">₹{record.gross_salary?.toLocaleString()}</p>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm text-red-600">₹{record.total_deductions?.toLocaleString()}</p>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm font-bold text-emerald-600">₹{record.net_salary?.toLocaleString()}</p>
                </td>
                <td className="px-6 py-4">
                  <Badge color="green">Processed</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {payrollRecords.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <p>No payroll records found</p>
          </div>
        )}
      </Card>

      {showProcessModal && (
        <PayrollProcessModal 
          employees={employees}
          onClose={() => setShowProcessModal(false)}
          onProcess={handleProcessPayroll}
        />
      )}
    </div>
  );
};

// --- Payroll Process Modal ---
const PayrollProcessModal = ({ employees, onClose, onProcess }) => {
  const [form, setForm] = useState({ employee_id: '', month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onProcess(form);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-2xl w-full max-w-md shadow-2xl">
        <h2 className="text-2xl font-bold mb-6">Process Payroll</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Select Employee</label>
            <select className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none" required value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })}>
              <option value="">Choose employee...</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} - {emp.department}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Month</label>
            <select className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none" value={form.month} onChange={e => setForm({ ...form, month: parseInt(e.target.value) })}>
              {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((month, idx) => (
                <option key={idx} value={idx + 1}>{month}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Year</label>
            <input type="number" className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-400 outline-none" value={form.year} onChange={e => setForm({ ...form, year: parseInt(e.target.value) })} min="2020" max="2030" />
          </div>
          <div className="flex gap-2 mt-6">
            <button type="button" onClick={onClose} className="flex-1 py-3 border border-slate-200 rounded-xl font-bold">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold">
              {loading ? 'Processing...' : 'Process Payroll'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
// --- Set Salary Modal ---
const SetSalaryModal = ({ employee, onClose, onSaved }) => {
  const [form, setForm] = useState({
    employee_id: employee.id,
    basic_salary: '',
    hra: '',
    transport_allowance: '',
    medical_allowance: '',
    special_allowance: '',
    pf_deduction: '',
    tax_deduction: '',
    other_deductions: '',
    effective_from: new Date().toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Pre-fill if salary already exists
    axios.get(`${API_URL}/employees/${employee.id}/salary`)
      .then(res => {
        const s = res.data;
        setForm(f => ({ ...f, ...s, employee_id: employee.id, effective_from: s.effective_from || f.effective_from }));
      })
      .catch(() => {});
  }, [employee.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_URL}/employees/${employee.id}/salary`, {
        ...form,
        basic_salary: parseFloat(form.basic_salary) || 0,
        hra: parseFloat(form.hra) || 0,
        transport_allowance: parseFloat(form.transport_allowance) || 0,
        medical_allowance: parseFloat(form.medical_allowance) || 0,
        special_allowance: parseFloat(form.special_allowance) || 0,
        pf_deduction: parseFloat(form.pf_deduction) || 0,
        tax_deduction: parseFloat(form.tax_deduction) || 0,
        other_deductions: parseFloat(form.other_deductions) || 0,
      });
      onSaved();
      onClose();
    } catch (err) {
      alert('Failed to save salary: ' + (err.response?.data?.detail || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const field = (label, key) => (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      <input
        type="number"
        min="0"
        step="0.01"
        placeholder="0"
        value={form[key]}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Set Salary Structure</h2>
            <p className="text-sm text-slate-500">{employee.first_name} {employee.last_name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Earnings</p>
          <div className="grid grid-cols-2 gap-3">
            {field('Basic Salary', 'basic_salary')}
            {field('HRA', 'hra')}
            {field('Transport Allowance', 'transport_allowance')}
            {field('Medical Allowance', 'medical_allowance')}
            {field('Special Allowance', 'special_allowance')}
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider pt-2">Deductions</p>
          <div className="grid grid-cols-2 gap-3">
            {field('PF Deduction', 'pf_deduction')}
            {field('Tax Deduction', 'tax_deduction')}
            {field('Other Deductions', 'other_deductions')}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Effective From</label>
            <input type="date" value={form.effective_from} onChange={e => setForm({ ...form, effective_from: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl font-bold text-sm hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-60">
              {loading ? 'Saving...' : 'Save Salary'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// --- Admin Leave Management ---
const AdminLeaves = () => {
  const [leaves, setLeaves] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    try {
      const res = await axios.get(`${API_URL}/leaves/`);
      setLeaves(res.data);
    } catch (err) {
      console.error('Failed to fetch leaves:', err);
    }
  };

  const handleApproveLeave = async (leaveId) => {
    try {
      await axios.post(`${API_URL}/management/leaves/${leaveId}/approve`);
      fetchLeaves();
    } catch (err) {
      alert('Failed to approve leave');
    }
  };

  const handleRejectLeave = async (leaveId) => {
    try {
      await axios.post(`${API_URL}/management/leaves/${leaveId}/reject`);
      fetchLeaves();
    } catch (err) {
      alert('Failed to reject leave');
    }
  };

  const filteredLeaves = filter === 'all' ? leaves : leaves.filter(leave => leave.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-slate-800">Leave Management</h3>
        <div className="flex gap-2">
          {['all', 'pending', 'approved', 'rejected'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-xl font-bold transition-all ${
                filter === status ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>
      
      <Card>
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Employee</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Leave Type</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Period</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Days</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredLeaves.map(leave => (
              <tr key={leave.id} className="hover:bg-slate-50/50 transition-all">
                <td className="px-6 py-4">
                  <p className="font-bold text-slate-800">{leave.employee_name || 'Employee ' + leave.employee_id}</p>
                  <p className="text-xs text-slate-500">{leave.department}</p>
                </td>
                <td className="px-6 py-4">
                  <Badge color="blue">{leave.leave_type}</Badge>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm text-slate-700">{leave.start_date} to {leave.end_date}</p>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm font-bold text-slate-800">{leave.days}</p>
                </td>
                <td className="px-6 py-4">
                  <Badge color={leave.status === 'approved' ? 'green' : leave.status === 'rejected' ? 'red' : 'yellow'}>
                    {leave.status}
                  </Badge>
                </td>
                <td className="px-6 py-4">
                  {leave.status === 'pending' && (
                    <div className="flex gap-2">
                      <button onClick={() => handleApproveLeave(leave.id)} className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                        Approve
                      </button>
                      <button onClick={() => handleRejectLeave(leave.id)} className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
                        Reject
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredLeaves.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <p>No leave requests found</p>
          </div>
        )}
      </Card>
    </div>
  );
};
// --- Admin Reports ---
const AdminReports = () => {
  const [reportType, setReportType] = useState('payroll');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    try {
      let res;
      switch (reportType) {
        case 'payroll':
          res = await axios.get(`${API_URL}/reports/payroll-summary`);
          break;
        case 'attendance':
          res = await axios.get(`${API_URL}/reports/attendance-summary`);
          break;
        case 'leave':
          res = await axios.get(`${API_URL}/reports/leave-summary`);
          break;
        default:
          res = { data: { message: 'Report not available' } };
      }
      setReportData(res.data);
    } catch (err) {
      console.error('Failed to generate report:', err);
    } finally {
      setLoading(false);
    }
  };

  const downloadAsPDF = () => {
    if (!reportData) return;
    const titles = { payroll: 'Payroll Summary Report', attendance: 'Attendance Report', leave: 'Leave Analytics Report' };
    const rows = [];
    const buildRows = (obj, prefix = '') => {
      Object.entries(obj).forEach(([k, v]) => {
        if (v === null || v === undefined) return;
        const label = (prefix ? prefix + ' › ' : '') + k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        if (typeof v === 'object' && !Array.isArray(v)) {
          rows.push({ type: 'section', label: label });
          buildRows(v, '');
        } else if (Array.isArray(v)) {
          rows.push({ label, value: `${v.length} records` });
        } else {
          const isAmount = k.includes('salary') || k.includes('budget') || k.includes('gross') || k.includes('net') || k.includes('total');
          rows.push({ label, value: isAmount && typeof v === 'number' ? `₹${v.toLocaleString()}` : String(v) });
        }
      });
    };
    buildRows(reportData);
    makePDF(
      titles[reportType] || 'Report',
      `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      rows,
      `${reportType}-report-${new Date().toISOString().split('T')[0]}.pdf`
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-slate-800">Reports & Analytics</h3>
        <div className="flex gap-4 items-center">
          <select className="px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-400 outline-none" value={reportType} onChange={e => setReportType(e.target.value)}>
            <option value="payroll">Payroll Summary</option>
            <option value="attendance">Attendance Report</option>
            <option value="leave">Leave Analytics</option>
          </select>
          <button onClick={generateReport} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all">
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
          <div className="relative">
            <button
              onClick={downloadAsPDF}
              disabled={!reportData}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              ⬇ Download PDF
            </button>
          </div>
        </div>
      </div>

      {reportData && (
        <Card className="p-6">
          <h4 className="font-bold text-slate-800 mb-4">Generated Report</h4>
          <pre className="text-sm text-slate-600 bg-slate-50 p-4 rounded-xl overflow-x-auto">
            {JSON.stringify(reportData, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
};
// --- Admin Departments ---
const AdminDepartments = () => {
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [departmentTeam, setDepartmentTeam] = useState([]);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const res = await axios.get(`${API_URL}/departments/`);
      setDepartments(res.data);
    } catch (err) {
      console.error('Failed to fetch departments:', err);
    }
  };

  const handleViewTeam = async (deptName) => {
    try {
      const res = await axios.get(`${API_URL}/employees/`);
      const teamMembers = res.data.filter(emp => emp.department === deptName);
      setDepartmentTeam(teamMembers);
      setSelectedDepartment(deptName);
      setShowTeamModal(true);
    } catch (err) {
      console.error('Failed to fetch team members:', err);
      alert('Failed to load team members');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-slate-800">Department Management</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {departments.map((dept, i) => (
          <Card key={i} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-slate-800">{dept.name}</h4>
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-bold text-xs">{dept.employee_count}</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Total Employees</span>
                <span className="font-bold text-slate-800">{dept.employee_count}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Active Employees</span>
                <span className="font-bold text-emerald-600">{dept.active_employee_count}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Avg Salary</span>
                <span className="font-bold text-slate-800">₹{Math.round(dept.avg_salary).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Total Budget</span>
                <span className="font-bold text-blue-600">₹{dept.total_budget.toLocaleString()}</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="flex gap-2">
                <button onClick={() => handleViewTeam(dept.name)} className="w-full px-3 py-1 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all">
                  View Team
                </button>
              </div>
            </div>
          </Card>
        ))}
        {departments.length === 0 && (
          <div className="col-span-full text-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-slate-400 text-2xl">🏢</span>
            </div>
            <p className="text-slate-500">No departments found</p>
            <p className="text-sm text-slate-400">Add your first department to get started</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-50 rounded-xl">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Departments</p>
          <p className="text-2xl font-bold text-slate-800">{departments.length}</p>
        </div>
        <div className="p-4 bg-slate-50 rounded-xl">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Employees</p>
          <p className="text-2xl font-bold text-slate-800">{departments.reduce((sum, dept) => sum + dept.employee_count, 0)}</p>
        </div>
        <div className="p-4 bg-slate-50 rounded-xl">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Avg Team Size</p>
          <p className="text-2xl font-bold text-slate-800">{departments.length > 0 ? Math.round(departments.reduce((sum, dept) => sum + dept.employee_count, 0) / departments.length) : 0}</p>
        </div>
        <div className="p-4 bg-slate-50 rounded-xl">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Budget</p>
          <p className="text-2xl font-bold text-emerald-600">₹{(departments.reduce((sum, dept) => sum + dept.total_budget, 0) / 100000).toFixed(1)}L</p>
        </div>
      </div>

      {/* View Team Modal */}
      {showTeamModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-800">Team Members - {selectedDepartment}</h3>
              <button onClick={() => setShowTeamModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3">
              {departmentTeam.map(member => (
                <div key={member.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-bold text-sm">{member.first_name[0]}{member.last_name[0]}</span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{member.first_name} {member.last_name}</p>
                      <p className="text-sm text-slate-500">{member.designation || 'Employee'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-800">{member.email}</p>
                    <p className="text-xs text-slate-500">ID: {member.employee_id}</p>
                  </div>
                </div>
              ))}
              {departmentTeam.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <p>No team members found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Employee Salary View ---
const EmployeeSalary = () => {
  const [salaryInfo, setSalaryInfo] = useState(null);
  const [payrollHistory, setPayrollHistory] = useState([]);
  const [notConfigured, setNotConfigured] = useState(false);

  useEffect(() => {
    fetchSalaryInfo();
    fetchPayrollHistory();
  }, []);

  const fetchSalaryInfo = async () => {
    try {
      const res = await axios.get(`${API_URL}/employee/me/salary`);
      setSalaryInfo(res.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setNotConfigured(true);
      } else {
        console.error('Failed to fetch salary info:', err);
      }
    }
  };

  const fetchPayrollHistory = async () => {
    try {
      const res = await axios.get(`${API_URL}/employee/me/payroll`);
      setPayrollHistory(res.data);
    } catch (err) {
      console.error('Failed to fetch payroll history:', err);
    }
  };

  const handleDownloadSalaryStructure = () => {
    if (!salaryInfo) return;
    const gross = (salaryInfo.basic_salary||0)+(salaryInfo.hra||0)+(salaryInfo.transport_allowance||0)+(salaryInfo.medical_allowance||0)+(salaryInfo.special_allowance||0);
    const totalDed = (salaryInfo.pf_deduction||0)+(salaryInfo.tax_deduction||0)+(salaryInfo.other_deductions||0);
    const net = gross - totalDed;
    makePDF(
      'Salary Structure',
      `Effective: ${salaryInfo.effective_from || new Date().toLocaleDateString()}`,
      [
        { type: 'section', label: 'Earnings' },
        { label: 'Basic Salary', value: `₹${(salaryInfo.basic_salary||0).toLocaleString()}`, color: 'green' },
        { label: 'House Rent Allowance (HRA)', value: `₹${(salaryInfo.hra||0).toLocaleString()}`, color: 'green' },
        { label: 'Transport Allowance', value: `₹${(salaryInfo.transport_allowance||0).toLocaleString()}`, color: 'green' },
        { label: 'Medical Allowance', value: `₹${(salaryInfo.medical_allowance||0).toLocaleString()}`, color: 'green' },
        { label: 'Special Allowance', value: `₹${(salaryInfo.special_allowance||0).toLocaleString()}`, color: 'green' },
        { label: 'Gross Earnings', value: `₹${gross.toLocaleString()}`, color: 'green' },
        null,
        { type: 'section', label: 'Deductions' },
        { label: 'Provident Fund (PF)', value: `₹${(salaryInfo.pf_deduction||0).toLocaleString()}`, color: 'red' },
        { label: 'Tax Deduction (TDS)', value: `₹${(salaryInfo.tax_deduction||0).toLocaleString()}`, color: 'red' },
        { label: 'Other Deductions', value: `₹${(salaryInfo.other_deductions||0).toLocaleString()}`, color: 'red' },
        { label: 'Total Deductions', value: `₹${totalDed.toLocaleString()}`, color: 'red' },
        null,
        { type: 'section', label: 'Net Salary' },
        { label: 'Net Monthly Salary', value: `₹${net.toLocaleString()}`, color: 'green' },
        { label: 'Net Annual Salary', value: `₹${(net * 12).toLocaleString()}`, color: 'green' },
      ],
      `salary_structure_${new Date().toISOString().split('T')[0]}.pdf`
    );
  };

  const handleDownloadPayslip = (payroll) => {
    const monthLabel = new Date(payroll.year, payroll.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    makePDF(
      'Employee Payslip',
      `Period: ${monthLabel}  |  Processed: ${new Date(payroll.processed_at).toLocaleDateString()}`,
      [
        { type: 'section', label: 'Earnings' },
        { label: 'Basic Salary', value: `₹${(payroll.basic_salary||0).toLocaleString()}`, color: 'green' },
        { label: 'HRA', value: `₹${(payroll.hra||0).toLocaleString()}`, color: 'green' },
        { label: 'Transport Allowance', value: `₹${(payroll.transport_allowance||0).toLocaleString()}`, color: 'green' },
        { label: 'Medical Allowance', value: `₹${(payroll.medical_allowance||0).toLocaleString()}`, color: 'green' },
        { label: 'Special Allowance', value: `₹${(payroll.special_allowance||0).toLocaleString()}`, color: 'green' },
        { label: 'Gross Salary', value: `₹${(payroll.gross_salary||0).toLocaleString()}`, color: 'green' },
        null,
        { type: 'section', label: 'Deductions' },
        { label: 'Provident Fund (PF)', value: `₹${(payroll.pf_deduction||0).toLocaleString()}`, color: 'red' },
        { label: 'Tax Deduction (TDS)', value: `₹${(payroll.tax_deduction||0).toLocaleString()}`, color: 'red' },
        { label: 'Other Deductions', value: `₹${(payroll.other_deductions||0).toLocaleString()}`, color: 'red' },
        { label: 'Total Deductions', value: `₹${(payroll.total_deductions||0).toLocaleString()}`, color: 'red' },
        null,
        { type: 'section', label: 'Net Pay' },
        { label: 'Net Salary', value: `₹${(payroll.net_salary||0).toLocaleString()}`, color: 'green' },
        null,
        { type: 'section', label: 'Attendance' },
        { label: 'Days Present', value: String(payroll.days_present || 0) },
        { label: 'Leaves Taken', value: String(payroll.leaves_taken || 0) },
      ],
      `payslip_${payroll.year}_${String(payroll.month).padStart(2,'0')}.pdf`
    );
  };

  return (
    <div className="space-y-6">
      <h3 className="font-bold text-slate-800">My Salary Information</h3>

      {notConfigured && (
        <Card className="p-10 text-center">
          <div className="text-5xl mb-4">💼</div>
          <h4 className="font-bold text-slate-800 text-lg mb-2">Salary Not Configured Yet</h4>
          <p className="text-slate-500 text-sm">Your salary structure hasn't been set up yet. Please contact your HR administrator to configure your salary details.</p>
        </Card>
      )}
      
      {salaryInfo && (
        <Card className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-bold text-slate-800">Current Salary Structure</h4>
            <button onClick={handleDownloadSalaryStructure} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all text-sm">
              Download Structure
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                <span className="text-sm text-slate-600">Basic Salary</span>
                <span className="font-bold text-slate-800">₹{salaryInfo.basic_salary?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                <span className="text-sm text-slate-600">HRA</span>
                <span className="font-bold text-slate-800">₹{salaryInfo.hra?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                <span className="text-sm text-slate-600">Transport Allowance</span>
                <span className="font-bold text-slate-800">₹{salaryInfo.transport_allowance?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                <span className="text-sm text-slate-600">Medical Allowance</span>
                <span className="font-bold text-slate-800">₹{salaryInfo.medical_allowance?.toLocaleString()}</span>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                <span className="text-sm text-slate-600">Special Allowance</span>
                <span className="font-bold text-slate-800">₹{salaryInfo.special_allowance?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-red-50 rounded-xl">
                <span className="text-sm text-slate-600">PF Deduction</span>
                <span className="font-bold text-red-600">-₹{salaryInfo.pf_deduction?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-red-50 rounded-xl">
                <span className="text-sm text-slate-600">Tax Deduction</span>
                <span className="font-bold text-red-600">-₹{salaryInfo.tax_deduction?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-emerald-50 rounded-xl border-2 border-emerald-200">
                <span className="text-sm font-bold text-emerald-700">Net Salary</span>
                <span className="font-bold text-emerald-700 text-lg">₹{(
                  (salaryInfo.basic_salary || 0) +
                  (salaryInfo.hra || 0) +
                  (salaryInfo.transport_allowance || 0) +
                  (salaryInfo.medical_allowance || 0) +
                  (salaryInfo.special_allowance || 0) -
                  (salaryInfo.pf_deduction || 0) -
                  (salaryInfo.tax_deduction || 0) -
                  (salaryInfo.other_deductions || 0)
                ).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <h4 className="font-bold text-slate-800 mb-6">Payroll History</h4>
        <div className="space-y-4">
          {payrollHistory.map(payroll => (
            <div key={payroll.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div>
                <p className="font-bold text-slate-800">
                  {new Date(payroll.year, payroll.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
                <p className="text-sm text-slate-500">Processed on: {new Date(payroll.processed_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-4">
                <p className="text-lg font-bold text-emerald-600">₹{payroll.net_salary.toLocaleString()}</p>
                <button
                  onClick={() => handleDownloadPayslip(payroll)}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all flex items-center gap-1.5 shadow-sm"
                >
                  ⬇ Payslip
                </button>
              </div>
            </div>
          ))}
          {payrollHistory.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <p>No payroll records found</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
// --- Employee Leave Management ---
const EmployeeLeaves = () => {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [deductionPrompt, setDeductionPrompt] = useState(null);
  const [userGender, setUserGender] = useState('other');

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    setUserGender((storedUser.gender || 'other').toLowerCase());
    fetchLeaveRequests();
    fetchLeaveBalance();
  }, []);

  const fetchLeaveRequests = async () => {
    try {
      const res = await axios.get(`${API_URL}/employee/me/leaves`);
      setLeaveRequests(res.data);
    } catch (err) {
      console.error('Failed to fetch leave requests:', err);
    }
  };

  const fetchLeaveBalance = async () => {
    try {
      const res = await axios.get(`${API_URL}/employee/me/leave-balance`);
      setLeaveBalance(res.data);
    } catch (err) {
      console.error('Failed to fetch leave balance:', err);
    }
  };

  const handleApplyLeave = async (formData) => {
    try {
      await axios.post(`${API_URL}/employee/me/leaves`, formData);
      fetchLeaveRequests();
      fetchLeaveBalance();
      setShowApplyModal(false);
      setDeductionPrompt(null);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail && detail.code === 'DEDUCTION_REQUIRED') {
        setDeductionPrompt({
          message: detail.message,
          deductionAmount: detail.deduction_amount,
          formData: formData
        });
      } else {
        alert('Leave application failed: ' + (typeof detail === 'string' ? detail : JSON.stringify(detail) || 'Unknown error'));
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-slate-800">My Leave Management</h3>
        <button onClick={() => setShowApplyModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all">
          Apply for Leave
        </button>
      </div>

      {leaveBalance && (
        <Card className="p-6">
          <h4 className="font-bold text-slate-800 mb-6">Leave Balance Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {leaveBalance.balance_by_type.map((balance, i) => (
              <div key={i} className="text-center p-4 bg-slate-50 rounded-xl">
                <div className="w-16 h-16 rounded-full border-4 border-blue-500 border-t-slate-200 mx-auto mb-2 flex items-center justify-center">
                  <span className="text-sm font-bold text-slate-800">{balance.remaining}</span>
                </div>
                <p className="text-xs font-medium text-slate-600 capitalize">{balance.leave_type}</p>
                <p className="text-xs text-slate-400">{balance.used} used</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-6">
        <h4 className="font-bold text-slate-800 mb-6">Leave Request History</h4>
        <div className="space-y-4">
          {leaveRequests.map(leave => (
            <div key={leave.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Badge color="blue">{leave.leave_type}</Badge>
                  <Badge color={leave.status === 'approved' ? 'green' : leave.status === 'rejected' ? 'red' : 'yellow'}>
                    {leave.status}
                  </Badge>
                </div>
                <p className="text-sm text-slate-700">
                  {leave.start_date} to {leave.end_date} ({leave.days} days)
                </p>
                {leave.reason && (
                  <p className="text-xs text-slate-500 mt-1">Reason: {leave.reason}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Applied: {new Date(leave.applied_at).toLocaleDateString()}</p>
                {leave.status === 'pending' && (
                  <button className="text-xs text-red-600 hover:underline mt-1">Cancel Request</button>
                )}
              </div>
            </div>
          ))}
          {leaveRequests.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <p>No leave requests found</p>
            </div>
          )}
        </div>
      </Card>

      {showApplyModal && (
        <ApplyLeaveModal 
          onClose={() => setShowApplyModal(false)}
          onApply={handleApplyLeave}
          userGender={userGender}
        />
      )}

      {deductionPrompt && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-100 text-red-600 mb-6 mx-auto shadow-inner">
              <span className="text-2xl">⚠️</span>
            </div>
            <h2 className="text-2xl font-black text-center mb-3 text-slate-800">Leave Limit Exceeded</h2>
            <p className="text-center text-slate-600 mb-6 text-sm leading-relaxed">{deductionPrompt.message}</p>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-8 text-center shadow-sm">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2">Estimated Salary Deduction</p>
              <p className="text-3xl font-black text-red-600">₹{deductionPrompt.deductionAmount?.toLocaleString()}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeductionPrompt(null)} className="flex-1 py-3.5 border-2 border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all">Cancel</button>
              <button onClick={() => handleApplyLeave({ ...deductionPrompt.formData, agreed_to_deduction: true })} className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-200/50">
                Proceed
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
// --- Employee Attendance ---
const EmployeeAttendance = () => {
  const [attendance, setAttendance] = useState([]);
  const [todayStatus, setTodayStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAttendance();
    fetchTodayStatus();
  }, []);

  const fetchAttendance = async () => {
    try {
      const res = await axios.get(`${API_URL}/employee/me/attendance`);
      setAttendance(res.data);
    } catch (err) {
      console.error('Failed to fetch attendance:', err);
    }
  };

  const fetchTodayStatus = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await axios.get(`${API_URL}/employee/me/attendance?start_date=${today}&end_date=${today}`);
      const todayRecord = Array.isArray(res.data) ? (res.data[0] || null) : (res.data || null);
      setTodayStatus(todayRecord);
    } catch (err) {
      console.error('Failed to fetch today status:', err);
    }
  };

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_URL}/attendance/my/check-in`);
      fetchTodayStatus();
      fetchAttendance();
    } catch (err) {
      alert('Check-in failed: ' + (err.response?.data?.detail || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_URL}/attendance/my/check-out`);
      fetchTodayStatus();
      fetchAttendance();
    } catch (err) {
      alert('Check-out failed: ' + (err.response?.data?.detail || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleViewCalendar = () => {
    const currentMonthNum = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const daysInMonth = new Date(currentYear, currentMonthNum, 0).getDate();
    const rows = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${String(currentMonthNum).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const dayName = new Date(currentYear, currentMonthNum - 1, day).toLocaleDateString('en-US', { weekday: 'short' });
      const rec = attendance.find(a => a.date === dateStr);
      const dow = new Date(currentYear, currentMonthNum - 1, day).getDay();
      const isWeekend = dow === 0 || dow === 6;
      const status = rec ? rec.status : (isWeekend ? 'Weekend' : '-');
      const checkIn = rec?.check_in_time ? new Date(rec.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-';
      const checkOut = rec?.check_out_time ? new Date(rec.check_out_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-';
      rows.push({
        label: `${dateStr} (${dayName})  In: ${checkIn}  Out: ${checkOut}`,
        value: status.charAt(0).toUpperCase() + status.slice(1),
        color: status === 'present' ? 'green' : status === 'absent' ? 'red' : 'default',
      });
    }
    makePDF(
      'Attendance Calendar',
      monthLabel,
      rows,
      `attendance_calendar_${currentYear}_${String(currentMonthNum).padStart(2,'0')}.pdf`
    );
  };
  const handleDownloadReport = () => {
    const reportData = attendance.map(record => ({
      Date: record.date,
      Status: record.status.charAt(0).toUpperCase() + record.status.slice(1),
      'Check In': record.check_in || '-',
      'Check Out': record.check_out || '-'
    }));
    
    let csvContent = "Date,Status,Check In,Check Out\n";
    reportData.forEach(row => {
      csvContent += `${row.Date},${row.Status},${row['Check In']},${row['Check Out']}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const currentMonth = attendance.filter(a => {
    const date = new Date(a.date);
    return date.getMonth() === new Date().getMonth() && date.getFullYear() === new Date().getFullYear();
  });

  const presentDays = currentMonth.filter(a => a.status === 'present').length;
  const totalDays = currentMonth.length;
  const attendancePercentage = totalDays > 0 ? (presentDays / totalDays * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      <h3 className="font-bold text-slate-800">My Attendance</h3>

      <Card className="p-6">
        <h4 className="font-bold text-slate-800 mb-6">Today's Status</h4>
        <div className="text-center py-8">
          {todayStatus ? (
            <div>
              <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">✅</span>
              </div>
              <p className="text-lg font-bold text-emerald-600 mb-2">
                {todayStatus.status === 'present' ? 'Checked In' : todayStatus.status}
              </p>
              {todayStatus.check_in_time && (
                <p className="text-sm text-slate-500">Check-in: {new Date(todayStatus.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
              )}
              {todayStatus.check_out_time && (
                <p className="text-sm text-slate-500">Check-out: {new Date(todayStatus.check_out_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
              )}
            </div>
          ) : (
            <div>
              <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">⏰</span>
              </div>
              <p className="text-lg font-bold text-slate-600 mb-4">Checked Out</p>
              <button onClick={handleCheckIn} disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all">
                {loading ? 'Processing...' : 'Check In'}
              </button>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <h4 className="font-bold text-slate-800 mb-4">This Month</h4>
          <div className="text-center">
            <div className="w-20 h-20 rounded-full border-4 border-blue-500 border-t-slate-200 mx-auto mb-2 flex items-center justify-center">
              <span className="text-lg font-bold text-slate-800">{attendancePercentage}%</span>
            </div>
            <p className="text-sm text-slate-600">Attendance Rate</p>
            <p className="text-xs text-slate-400 mt-1">{presentDays}/{totalDays} days</p>
          </div>
        </Card>

        <Card className="p-6">
          <h4 className="font-bold text-slate-800 mb-4">Summary</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Present</span>
              <span className="font-bold text-emerald-600">{presentDays}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Absent</span>
              <span className="font-bold text-red-600">{currentMonth.filter(a => a.status === 'absent').length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Leave</span>
              <span className="font-bold text-amber-600">{currentMonth.filter(a => a.status === 'leave').length}</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h4 className="font-bold text-slate-800 mb-4">Quick Actions</h4>
          <div className="space-y-3">
            <button onClick={handleViewCalendar} className="w-full px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all">
              View Calendar
            </button>
            <button onClick={handleDownloadReport} className="w-full px-4 py-2 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all">
              Download Report
            </button>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h4 className="font-bold text-slate-800 mb-6">Recent Attendance</h4>
        <div className="space-y-3">
          {attendance.slice(0, 10).map(record => (
            <div key={record.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  record.status === 'present' ? 'bg-emerald-500' : 
                  record.status === 'absent' ? 'bg-red-500' : 'bg-amber-500'
                }`}></div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{new Date(record.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                  <p className="text-xs text-slate-500">
                    {record.check_in_time && `In: ${new Date(record.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
                    {record.check_out_time && ` • Out: ${new Date(record.check_out_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                </div>
              </div>
              <Badge color={record.status === 'present' ? 'green' : record.status === 'absent' ? 'red' : 'yellow'}>
                {record.status}
              </Badge>
            </div>
          ))}
          {attendance.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <p>No attendance records found</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

// --- Main App Component ---
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setIsAuthenticated(true);
      setUserRole(parsedUser.role);
      setUser(parsedUser);
    }
  }, []);

  const handleAuthSuccess = (val) => {
    const storedUser = JSON.parse(localStorage.getItem('user'));
    setIsAuthenticated(val);
    setUserRole(storedUser?.role);
    setUser(storedUser);
  };

  const handleLogout = () => {
    localStorage.clear();
    setIsAuthenticated(false);
    setUserRole(null);
    setUser(null);
    setShowLogin(false);
  };

  if (isAuthenticated) {
    return (
      <Router>
        <Layout role={userRole} user={user} onLogout={handleLogout} />
      </Router>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {showLogin ? (
        <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <Login setAuth={handleAuthSuccess} onBack={() => setShowLogin(false)} />
        </motion.div>
      ) : (
        <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <LandingPage onGetStarted={() => setShowLogin(true)} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default App;
