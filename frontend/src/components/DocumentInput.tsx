'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, User, Building } from 'lucide-react';

interface DocumentInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange?: (isValid: boolean, documentType: 'DNI' | 'RUC' | null) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

interface ValidationResult {
  isValid: boolean;
  documentType: 'DNI' | 'RUC' | null;
  message: string;
  suggestions?: string[];
}

export default function DocumentInput({
  value,
  onChange,
  onValidationChange,
  placeholder = "Ingrese DNI o RUC",
  className = "",
  required = false
}: DocumentInputProps) {
  const [validation, setValidation] = useState<ValidationResult>({
    isValid: false,
    documentType: null,
    message: ''
  });
  const [isFocused, setIsFocused] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  // Validar DNI (8 dígitos)
  const validateDNI = (dni: string): ValidationResult => {
    if (dni.length === 0) {
      return {
        isValid: false,
        documentType: null,
        message: ''
      };
    }

    if (!/^\d+$/.test(dni)) {
      return {
        isValid: false,
        documentType: 'DNI',
        message: 'El DNI solo debe contener números',
        suggestions: ['Elimine espacios, guiones o letras']
      };
    }

    if (dni.length < 8) {
      return {
        isValid: false,
        documentType: 'DNI',
        message: `DNI incompleto (${dni.length}/8 dígitos)`,
        suggestions: [`Faltan ${8 - dni.length} dígitos`]
      };
    }

    if (dni.length > 8) {
      return {
        isValid: false,
        documentType: 'DNI',
        message: 'DNI muy largo (máximo 8 dígitos)',
        suggestions: ['Verifique que no haya dígitos adicionales']
      };
    }

    // Validaciones adicionales para DNI
    if (dni === '00000000' || dni === '11111111' || dni === '12345678') {
      return {
        isValid: false,
        documentType: 'DNI',
        message: 'DNI no válido',
        suggestions: ['Este DNI no es válido']
      };
    }

    return {
      isValid: true,
      documentType: 'DNI',
      message: 'DNI válido'
    };
  };

  // Validar RUC (11 dígitos)
  const validateRUC = (ruc: string): ValidationResult => {
    if (ruc.length === 0) {
      return {
        isValid: false,
        documentType: null,
        message: ''
      };
    }

    if (!/^\d+$/.test(ruc)) {
      return {
        isValid: false,
        documentType: 'RUC',
        message: 'El RUC solo debe contener números',
        suggestions: ['Elimine espacios, guiones o letras']
      };
    }

    if (ruc.length < 11) {
      return {
        isValid: false,
        documentType: 'RUC',
        message: `RUC incompleto (${ruc.length}/11 dígitos)`,
        suggestions: [`Faltan ${11 - ruc.length} dígitos`]
      };
    }

    if (ruc.length > 11) {
      return {
        isValid: false,
        documentType: 'RUC',
        message: 'RUC muy largo (máximo 11 dígitos)',
        suggestions: ['Verifique que no haya dígitos adicionales']
      };
    }

    // Validar que comience con 10, 15, 17, 20
    const firstTwoDigits = ruc.substring(0, 2);
    const validPrefixes = ['10', '15', '17', '20'];
    
    if (!validPrefixes.includes(firstTwoDigits)) {
      return {
        isValid: false,
        documentType: 'RUC',
        message: 'RUC no válido',
        suggestions: [
          'El RUC debe comenzar con:',
          '• 10 (Persona Natural)',
          '• 15 (Persona Natural no domiciliada)',
          '• 17 (Persona Natural no domiciliada)',
          '• 20 (Persona Jurídica)'
        ]
      };
    }

    // Validación básica del dígito verificador (simplificada)
    if (ruc === '00000000000' || ruc === '11111111111') {
      return {
        isValid: false,
        documentType: 'RUC',
        message: 'RUC no válido',
        suggestions: ['Este RUC no es válido']
      };
    }

    return {
      isValid: true,
      documentType: 'RUC',
      message: 'RUC válido'
    };
  };

  // Determinar tipo de documento y validar
  const validateDocument = (document: string): ValidationResult => {
    const cleanDocument = document.replace(/\D/g, ''); // Solo números
    
    if (cleanDocument.length === 0) {
      return {
        isValid: false,
        documentType: null,
        message: ''
      };
    }

    const firstTwoDigits = cleanDocument.substring(0, 2);
    const rucPrefixes = ['10', '15', '17', '20'];

    // Si empieza con prefijo de RUC, tratarlo siempre como RUC (aunque esté incompleto)
    if (rucPrefixes.includes(firstTwoDigits)) {
      return validateRUC(cleanDocument);
    }

    if (cleanDocument.length <= 8) {
      return validateDNI(cleanDocument);
    } else if (cleanDocument.length <= 11) {
      return validateRUC(cleanDocument);
    } else {
      return {
        isValid: false,
        documentType: null,
        message: 'Documento muy largo',
        suggestions: ['DNI: 8 dígitos', 'RUC: 11 dígitos']
      };
    }
  };

  useEffect(() => {
    const result = validateDocument(value);
    setValidation(result);
    
    if (onValidationChange) {
      onValidationChange(result.isValid, result.documentType);
    }
    // No incluir onValidationChange en dependencias para evitar bucles de render
  }, [value]);

  useEffect(() => {
    // Mostrar validación después de que el usuario haya empezado a escribir
    if (value.length > 0 && !isFocused) {
      setShowValidation(true);
    }
  }, [value, isFocused]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    // Permitir solo números y limitar longitud
    const cleanValue = inputValue.replace(/\D/g, '').substring(0, 11);
    onChange(cleanValue);
  };

  const getInputClassName = () => {
    let baseClass = `w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-200 ${className}`;
    
    if (value.length === 0) {
      return `${baseClass} border-gray-300 focus:ring-blue-500 focus:border-blue-500`;
    }
    
    if (validation.isValid) {
      return `${baseClass} border-green-500 focus:ring-green-500 focus:border-green-500 bg-green-50`;
    } else {
      return `${baseClass} border-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50`;
    }
  };

  const getDocumentTypeIcon = () => {
    if (!validation.documentType) return null;
    
    if (validation.documentType === 'DNI') {
      return <User className="w-4 h-4" />;
    } else {
      return <Building className="w-4 h-4" />;
    }
  };

  const getValidationIcon = () => {
    if (value.length === 0) return null;
    
    if (validation.isValid) {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    } else {
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className={getInputClassName()}
          required={required}
          maxLength={11}
        />
        
        {/* Iconos en el lado derecho */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 space-x-2">
          {validation.documentType && (
            <div className="flex items-center text-gray-500">
              {getDocumentTypeIcon()}
              <span className="ml-1 text-xs font-medium">
                {validation.documentType}
              </span>
            </div>
          )}
          {getValidationIcon()}
        </div>
      </div>

      {/* Feedback de validación */}
      {showValidation && validation.message && (
        <div className={`p-3 rounded-lg border ${
          validation.isValid 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-start">
            {validation.isValid ? (
              <CheckCircle className="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium">{validation.message}</p>
              {validation.suggestions && validation.suggestions.length > 0 && (
                <ul className="mt-1 text-xs space-y-1">
                  {validation.suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start">
                      {suggestion.startsWith('•') ? (
                        <span>{suggestion}</span>
                      ) : (
                        <span>• {suggestion}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Información adicional */}
      {value.length === 0 && isFocused && (
        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded border">
          <p className="font-medium mb-1">Tipos de documento aceptados:</p>
          <ul className="space-y-1">
            <li className="flex items-center">
              <User className="w-3 h-3 mr-1" />
              <span>DNI: 8 dígitos (personas naturales)</span>
            </li>
            <li className="flex items-center">
              <Building className="w-3 h-3 mr-1" />
              <span>RUC: 11 dígitos (empresas)</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
