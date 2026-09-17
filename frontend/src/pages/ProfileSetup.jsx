import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import '../styles/ProfileSetup.css';

const MEDICAL_CONDITIONS = [
  'Asthma',
  'Heart condition',
  'Diabetes',
  'Joint pain',
  'High blood pressure',
  'Breathing issues',
  'Allergies',
  'Lung disease'
];

const calculateAge = (dateString) => {
  if (!dateString) return null;
  const today = new Date();
  const birthDate = new Date(dateString);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age >= 0 ? age : null;
};

const ProfileSetup = () => {
  const navigate = useNavigate();
  const { user, updateProfile, logout } = useAuth();

  // Form state
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    dob: user?.dob || '',
    medicalConditions: user?.medical_conditions || [],
    activityLevel: user?.activity_level || '',
    emergencyContact: user?.emergency_contact || '',
    allergies: user?.allergies || ''
  });

  const [otherCondition, setOtherCondition] = useState('');
  const [age, setAge] = useState(null);
  const [step, setStep] = useState(1); // 1: Basic, 2: Medical, 3: Review
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Calculate age when DOB changes
  useEffect(() => {
    if (formData.dob) {
      const calculatedAge = calculateAge(formData.dob);
      setAge(calculatedAge);
    } else {
      setAge(null);
    }
  }, [formData.dob]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
    }
  }, [user, navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    setError(null);
  };

  const handleConditionToggle = (condition) => {
    setFormData({
      ...formData,
      medicalConditions: formData.medicalConditions.includes(condition)
        ? formData.medicalConditions.filter((c) => c !== condition)
        : [...formData.medicalConditions, condition]
    });
  };

  const handleAddOtherCondition = () => {
    if (otherCondition.trim() && !formData.medicalConditions.includes(otherCondition)) {
      setFormData({
        ...formData,
        medicalConditions: [...formData.medicalConditions, otherCondition]
      });
      setOtherCondition('');
    }
  };

  const handleRemoveCondition = (condition) => {
    setFormData({
      ...formData,
      medicalConditions: formData.medicalConditions.filter((c) => c !== condition)
    });
  };

  const validateStep = (currentStep) => {
    if (currentStep === 1) {
      if (!formData.name.trim()) {
        setError('Name is required');
        return false;
      }
      if (!formData.dob) {
        setError('Date of birth is required');
        return false;
      }
      if (!age || age < 13) {
        setError('You must be at least 13 years old');
        return false;
      }
    } else if (currentStep === 2) {
      if (!formData.activityLevel) {
        setError('Please select your activity level');
        return false;
      }
    }
    return true;
  };

  const handleNextStep = () => {
    if (validateStep(step)) {
      setError(null);
      setStep(step + 1);
    }
  };

  const handlePrevStep = () => {
    if (step > 1) {
      setStep(step - 1);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    try {
      setError(null);
      setLoading(true);

      // Prepare profile data
      const profileData = {
        name: formData.name,
        dob: formData.dob,
        age: age,
        medical_conditions: formData.medicalConditions,
        activity_level: formData.activityLevel
      };

      // Add optional fields
      if (formData.emergencyContact.trim()) {
        profileData.emergency_contact = formData.emergencyContact;
      }

      if (formData.allergies.trim()) {
        profileData.allergies = formData.allergies;
      }

      // Call backend to update profile
      const result = await updateProfile(profileData);

      if (!result.success) {
        setError(result.error || 'Failed to save profile');
        return;
      }

      // Show success message
      setShowSuccess(true);

      // Redirect to dashboard after 1.5 seconds
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 1500);
    } catch (err) {
      setError(err.message || 'An error occurred while saving your profile');
      console.error('Profile submit error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="profile-setup-container">
      <div className="profile-setup-content">
        {/* Header */}
        <div className="profile-header">
          <h1>Complete Your Profile</h1>
          <p>Help us personalize your experience</p>
        </div>

        {/* Progress Bar */}
        <div className="progress-bar">
          <div className="progress-steps">
            <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>
              <div className="step-number">1</div>
              <span className="step-label">Basic Info</span>
            </div>
            <div className="progress-line"></div>
            <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>
              <div className="step-number">2</div>
              <span className="step-label">Health</span>
            </div>
            <div className="progress-line"></div>
            <div className={`progress-step ${step >= 3 ? 'active' : ''}`}>
              <div className="step-number">3</div>
              <span className="step-label">Review</span>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="form-content">
          {showSuccess && (
            <div className="success-message">
              <CheckCircle size={24} />
              <p>Profile setup complete! Redirecting...</p>
            </div>
          )}

          {error && (
            <div className="error-message">
              <AlertCircle size={20} />
              <p>{error}</p>
            </div>
          )}

          {/* Step 1: Basic Information */}
          {step === 1 && (
            <div className="form-step">
              <h2>Basic Information</h2>

              <div className="form-group">
                <label htmlFor="name">Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Your name"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email (Read-only)</label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  disabled
                  className="form-input readonly"
                />
              </div>

              <div className="form-group">
                <label htmlFor="dob">Date of Birth</label>
                <input
                  type="date"
                  id="dob"
                  name="dob"
                  value={formData.dob}
                  onChange={handleInputChange}
                  className="form-input"
                />
                {age !== null && (
                  <div className="age-display">
                    <span className="age-badge">Age: {age}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Medical & Activity */}
          {step === 2 && (
            <div className="form-step">
              <h2>Health Information</h2>

              {/* Medical Conditions */}
              <div className="form-section">
                <h3>Do you have any medical conditions we should consider?</h3>
                <p className="section-description">
                  This helps us provide safer route recommendations
                </p>

                <div className="conditions-grid">
                  {MEDICAL_CONDITIONS.map((condition) => (
                    <button
                      key={condition}
                      className={`condition-chip ${
                        formData.medicalConditions.includes(condition) ? 'selected' : ''
                      }`}
                      onClick={() => handleConditionToggle(condition)}
                    >
                      {condition}
                    </button>
                  ))}
                </div>

                {/* Other Condition Input */}
                <div className="other-condition-input">
                  <input
                    type="text"
                    value={otherCondition}
                    onChange={(e) => setOtherCondition(e.target.value)}
                    placeholder="Other condition"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAddOtherCondition();
                      }
                    }}
                    className="form-input"
                  />
                  <button
                    className="btn-add-condition"
                    onClick={handleAddOtherCondition}
                    type="button"
                  >
                    Add
                  </button>
                </div>

                {/* Selected Conditions Display */}
                {formData.medicalConditions.length > 0 && (
                  <div className="selected-conditions">
                    <p className="selected-label">Selected:</p>
                    <div className="conditions-list">
                      {formData.medicalConditions.map((condition) => (
                        <div key={condition} className="condition-tag">
                          {condition}
                          <button
                            onClick={() => handleRemoveCondition(condition)}
                            className="remove-btn"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Activity Level */}
              <div className="form-section">
                <h3>Physical Activity Level</h3>
                <p className="section-description">
                  How would you describe your typical physical activity?
                </p>

                <div className="activity-options">
                  {['Beginner', 'Moderate', 'Active'].map((level) => (
                    <button
                      key={level}
                      className={`activity-option ${
                        formData.activityLevel === level ? 'selected' : ''
                      }`}
                      onClick={() =>
                        setFormData({
                          ...formData,
                          activityLevel: level
                        })
                      }
                    >
                      <div className="option-content">
                        <span className="option-title">{level}</span>
                        {level === 'Beginner' && (
                          <span className="option-desc">Low intensity activities</span>
                        )}
                        {level === 'Moderate' && (
                          <span className="option-desc">Regular exercise 3-4x per week</span>
                        )}
                        {level === 'Active' && (
                          <span className="option-desc">Intense exercise 5+ days per week</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Optional & Review */}
          {step === 3 && (
            <div className="form-step">
              <h2>Optional Information</h2>

              <div className="form-group">
                <label htmlFor="emergencyContact">Emergency Contact (Optional)</label>
                <input
                  type="tel"
                  id="emergencyContact"
                  name="emergencyContact"
                  value={formData.emergencyContact}
                  onChange={handleInputChange}
                  placeholder="Phone number or email"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="allergies">Allergies (Optional)</label>
                <textarea
                  id="allergies"
                  name="allergies"
                  value={formData.allergies}
                  onChange={handleInputChange}
                  placeholder="List any allergies or sensitivities"
                  rows="3"
                  className="form-input"
                ></textarea>
              </div>

              {/* Review Summary */}
              <div className="review-section">
                <h3>Review Your Information</h3>

                <div className="review-item">
                  <span className="review-label">Name:</span>
                  <span className="review-value">{formData.name}</span>
                </div>

                <div className="review-item">
                  <span className="review-label">Email:</span>
                  <span className="review-value">{formData.email}</span>
                </div>

                <div className="review-item">
                  <span className="review-label">Age:</span>
                  <span className="review-value">{age}</span>
                </div>

                <div className="review-item">
                  <span className="review-label">Activity Level:</span>
                  <span className="review-value">{formData.activityLevel}</span>
                </div>

                {formData.medicalConditions.length > 0 && (
                  <div className="review-item">
                    <span className="review-label">Medical Conditions:</span>
                    <span className="review-value">
                      {formData.medicalConditions.join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="form-actions">
            {step > 1 && (
              <button className="btn btn-secondary" onClick={handlePrevStep}>
                <ArrowLeft size={18} />
                <span>Previous</span>
              </button>
            )}

            {step < 3 && (
              <button className="btn btn-primary" onClick={handleNextStep}>
                <span>Next</span>
              </button>
            )}

            {step === 3 && (
              <button
                className="btn btn-primary btn-submit"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Complete Setup'}
              </button>
            )}

            <button className="btn btn-link" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSetup;
