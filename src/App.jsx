import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { Camera, List, FileSpreadsheet, X, CheckCircle, XCircle, Scan } from 'lucide-react';

function AdminApp() {
  const [screen, setScreen] = useState('home'); // 'home', 'scanner', 'today'
  const [scanning, setScanning] = useState(false);
  const [todaysAttendance, setTodaysAttendance] = useState({ present: [], absent: [] });
  const [scanResult, setScanResult] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);

  const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit';

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  // Mark attendance
const markAttendance = async (employeeId) => {
  const today = getTodayDate();
  
  try {
    // Check if employee exists
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .single();

    if (empError || !employee) {
      return null;
    }

    // Check if already marked today
    const { data: existing } = await supabase
      .from('attendance')
      .select('*')
      .eq('id', employeeId)
      .eq('date', today)
      .single();

    if (existing) {
      return { employee, alreadyMarked: true };
    }

    // Insert new attendance record
    const { error: insertError } = await supabase
      .from('attendance')
      .insert([{
        id: employeeId,
        date: today,
        status: 'present'
      }]);

    if (insertError) throw insertError;

    // Update Google Sheet
    await updateGoogleSheet({ id: employeeId, date: today, status: 'present' }, employee);

    return { employee, alreadyMarked: false };
  } catch (error) {
    console.error('Error marking attendance:', error);
    return null;
  }
};

  // Mock Google Sheet update
  const updateGoogleSheet = async (record, employee) => {
    console.log('Updating Google Sheet:', {
      date: record.date,
      id: employee.id,
      name: employee.name,
      status: record.status
    });
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // In real implementation:
    // - Format data for sheets
    // - Call Google Sheets API
    // - Update the specific row/column
  };

  // Start QR Scanner using native browser APIs
  const startScanner = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      
      setScanning(true);
      setScanResult(null);
      
      // Start scanning loop
      scanIntervalRef.current = setInterval(() => {
        captureAndScan();
      }, 500);
      
    } catch (err) {
      console.error("Error starting scanner:", err);
      alert("Camera access denied or not available");
      setScanning(false);
    }
  };

  // Capture frame and attempt to scan QR code
  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    if (canvas.width === 0 || canvas.height === 0) return;
    
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Get image data
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    
    // Try to decode QR code using jsQR (loaded from CDN)
    if (window.jsQR) {
      const code = window.jsQR(imageData.data, imageData.width, imageData.height);
      
      if (code) {
        // QR code detected!
        await stopScanner();
        
        // Mark attendance
        const result = await markAttendance(code.data);
        
        if (result) {
          setScanResult({
            success: true,
            employee: result.employee,
            alreadyMarked: result.alreadyMarked
          });
        } else {
          setScanResult({
            success: false,
            message: 'Employee not found'
          });
        }
      }
    }
  };

  // Stop QR Scanner
  const stopScanner = async () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setScanning(false);
  };

  // Fetch today's attendance
const fetchTodaysAttendance = async () => {
  const today = getTodayDate();
  
  try {
    // Get all employees
    const { data: allEmployees } = await supabase
      .from('employees')
      .select('*');

    // Get today's attendance
    const { data: todayAttendance } = await supabase
      .from('attendance')
      .select('id')
      .eq('date', today)
      .eq('status', 'present');

    const presentIds = new Set(todayAttendance?.map(a => a.id) || []);
    
    const present = allEmployees?.filter(emp => presentIds.has(emp.id)) || [];
    const absent = allEmployees?.filter(emp => !presentIds.has(emp.id)) || [];

    setTodaysAttendance({ present, absent });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    setTodaysAttendance({ present: [], absent: [] });
  }
};

  // Load jsQR library
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js';
    script.async = true;
    document.body.appendChild(script);
    
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  // Home Screen
  if (screen === 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100">
        {/* App Bar */}
        <div className="bg-white shadow-md">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <h1 className="text-xl font-bold text-gray-800">Admin Panel</h1>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto p-4 mt-12">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-500 rounded-full mb-4">
              <Scan className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Attendance Management</h2>
            <p className="text-gray-600">Scan QR codes and manage attendance</p>
          </div>

          <div className="space-y-4">
            {/* Scan QR Code Button */}
            <button
              onClick={() => setScreen('scanner')}
              className="w-full bg-white hover:bg-gray-50 rounded-2xl shadow-lg p-6 flex items-center justify-between transition duration-200 group"
            >
              <div className="flex items-center">
                <div className="w-14 h-14 bg-blue-500 rounded-xl flex items-center justify-center mr-4 group-hover:bg-blue-600 transition">
                  <Camera className="w-7 h-7 text-white" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-semibold text-gray-800">Scan QR Code</h3>
                  <p className="text-sm text-gray-600">Mark attendance by scanning</p>
                </div>
              </div>
              <div className="text-gray-400">›</div>
            </button>

            {/* Today's Attendance Button */}
            <button
              onClick={() => {
                fetchTodaysAttendance();
                setScreen('today');
              }}
              className="w-full bg-white hover:bg-gray-50 rounded-2xl shadow-lg p-6 flex items-center justify-between transition duration-200 group"
            >
              <div className="flex items-center">
                <div className="w-14 h-14 bg-green-500 rounded-xl flex items-center justify-center mr-4 group-hover:bg-green-600 transition">
                  <List className="w-7 h-7 text-white" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-semibold text-gray-800">Today's Attendance</h3>
                  <p className="text-sm text-gray-600">View present and absent list</p>
                </div>
              </div>
              <div className="text-gray-400">›</div>
            </button>

            {/* Google Sheet Link Button */}
            <button
              onClick={() => window.open(GOOGLE_SHEET_URL, '_blank')}
              className="w-full bg-white hover:bg-gray-50 rounded-2xl shadow-lg p-6 flex items-center justify-between transition duration-200 group"
            >
              <div className="flex items-center">
                <div className="w-14 h-14 bg-purple-500 rounded-xl flex items-center justify-center mr-4 group-hover:bg-purple-600 transition">
                  <FileSpreadsheet className="w-7 h-7 text-white" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-semibold text-gray-800">Open Google Sheet</h3>
                  <p className="text-sm text-gray-600">View full attendance records</p>
                </div>
              </div>
              <div className="text-gray-400">↗</div>
            </button>
          </div>

          {/* Demo Note */}
          <div className="mt-8 p-4 bg-white rounded-xl shadow">
            <p className="text-sm text-gray-600">
              <strong>Demo Mode:</strong> This is using mock data. In production, connect to Supabase and Google Sheets API.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Scanner Screen
  if (screen === 'scanner') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100">
        {/* App Bar */}
        <div className="bg-white shadow-md">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <button
              onClick={async () => {
                await stopScanner();
                setScreen('home');
                setScanResult(null);
              }}
              className="text-blue-600 hover:text-blue-700 flex items-center"
            >
              ← Back
            </button>
            <h1 className="text-xl font-bold text-gray-800">QR Scanner</h1>
            <div className="w-16"></div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto p-4 mt-8">
          {/* Scanner Result */}
          {scanResult && (
            <div className={`mb-6 p-6 rounded-2xl shadow-lg ${
              scanResult.success ? 'bg-green-50 border-2 border-green-200' : 'bg-red-50 border-2 border-red-200'
            }`}>
              <div className="flex items-start">
                {scanResult.success ? (
                  <CheckCircle className="w-6 h-6 text-green-600 mr-3 mt-1" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-600 mr-3 mt-1" />
                )}
                <div className="flex-1">
                  {scanResult.success ? (
                    <>
                      <h3 className="text-lg font-semibold text-green-800 mb-1">
                        {scanResult.alreadyMarked ? 'Already Marked!' : 'Attendance Marked!'}
                      </h3>
                      <p className="text-green-700">
                        <strong>{scanResult.employee.name}</strong> ({scanResult.employee.id})
                      </p>
                      <p className="text-sm text-green-600 mt-1">
                        Department: {scanResult.employee.department}
                      </p>
                      {scanResult.alreadyMarked && (
                        <p className="text-sm text-green-600 mt-2">
                          This employee was already marked present today.
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <h3 className="text-lg font-semibold text-red-800">Scan Failed</h3>
                      <p className="text-red-700">{scanResult.message}</p>
                    </>
                  )}
                </div>
                <button
                  onClick={() => setScanResult(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Scanner Container */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="relative">
              <video 
                ref={videoRef} 
                className="w-full rounded-xl"
                style={{ display: scanning ? 'block' : 'none' }}
              />
              <canvas 
                ref={canvasRef} 
                style={{ display: 'none' }}
              />
              
              {/* Scanning overlay */}
              {scanning && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-64 h-64 border-4 border-blue-500 rounded-2xl animate-pulse"></div>
                </div>
              )}
            </div>
            
            {!scanning && (
              <div className="text-center py-12">
                <Camera className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Ready to Scan</h3>
                <p className="text-gray-600 mb-6">Position the QR code within the frame</p>
                <button
                  onClick={startScanner}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-8 py-3 rounded-lg transition duration-200"
                >
                  Start Camera
                </button>
              </div>
            )}

            {scanning && (
              <div className="text-center mt-4">
                <p className="text-gray-600 mb-4">Point camera at QR code</p>
                <button
                  onClick={stopScanner}
                  className="bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-2 rounded-lg transition duration-200"
                >
                  Stop Camera
                </button>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-6 p-4 bg-blue-50 rounded-xl">
            <h4 className="font-semibold text-blue-900 mb-2">Instructions:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Allow camera access when prompted</li>
              <li>• Hold the QR code steady within the frame</li>
              <li>• Attendance will be marked automatically</li>
              <li>• Google Sheet will be updated</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Today's Attendance Screen
  if (screen === 'today') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100">
        {/* App Bar */}
        <div className="bg-white shadow-md">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <button
              onClick={() => setScreen('home')}
              className="text-blue-600 hover:text-blue-700 flex items-center"
            >
              ← Back
            </button>
            <h1 className="text-xl font-bold text-gray-800">Today's Attendance</h1>
            <div className="w-16"></div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto p-4 mt-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Present</p>
                  <p className="text-3xl font-bold text-green-600">{todaysAttendance.present.length}</p>
                </div>
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Absent</p>
                  <p className="text-3xl font-bold text-red-600">{todaysAttendance.absent.length}</p>
                </div>
                <XCircle className="w-10 h-10 text-red-500" />
              </div>
            </div>
          </div>

          {/* Present List */}
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              Present ({todaysAttendance.present.length})
            </h3>
            <div className="space-y-2">
              {todaysAttendance.present.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No one marked present yet</p>
              ) : (
                todaysAttendance.present.map((emp, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                    <div>
                      <p className="font-semibold text-gray-800">{emp.name}</p>
                      <p className="text-sm text-gray-600">{emp.id}</p>
                    </div>
                    <span className="text-sm text-gray-600 bg-white px-3 py-1 rounded-full">
                      {emp.department}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Absent List */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <XCircle className="w-5 h-5 text-red-600 mr-2" />
              Absent ({todaysAttendance.absent.length})
            </h3>
            <div className="space-y-2">
              {todaysAttendance.absent.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Everyone is present!</p>
              ) : (
                todaysAttendance.absent.map((emp, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                    <div>
                      <p className="font-semibold text-gray-800">{emp.name}</p>
                      <p className="text-sm text-gray-600">{emp.id}</p>
                    </div>
                    <span className="text-sm text-gray-600 bg-white px-3 py-1 rounded-full">
                      {emp.department}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default AdminApp;