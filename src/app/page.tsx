'use client'

import { Demo } from '@/components/Demo'

export default function Home() {
  const scrollToDemo = () => {
    const demoSection = document.getElementById('demo-section')
    if (demoSection) {
      demoSection.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="page">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title">ERC-8092</h1>
          <p className="hero-subtitle">Associated Accounts</p>
          <p className="hero-description">
            A standard for establishing and verifying associations between blockchain accounts. 
            Publicly declare, prove, and revoke relationships between addresses with cryptographic guarantees.
          </p>
          <div className="hero-features">
            <div className="feature">
              <span className="feature-icon">🔗</span>
              <span>Link Multiple Wallets</span>
            </div>
            <div className="feature">
              <span className="feature-icon">✍️</span>
              <span>EIP-712 Signatures</span>
            </div>
            <div className="feature">
              <span className="feature-icon">⛓️</span>
              <span>Onchain Storage</span>
            </div>
          </div>
          <button onClick={scrollToDemo} className="try-demo-btn">
            Try Demo
            <span className="arrow">↓</span>
          </button>
        </div>
        <div className="hero-visual">
          <div className="orbit-container">
            <div className="orbit orbit-1"></div>
            <div className="orbit orbit-2"></div>
            <div className="center-node"></div>
            <div className="satellite satellite-1"></div>
            <div className="satellite satellite-2"></div>
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo-section" className="demo-section">
        <div className="demo-header">
          <h3>Associate two wallets you control using ERC-8092</h3>
        </div>
        <Demo />
      </section>
    </div>
  )
}
