import React, { useState, useEffect } from 'react';

const API_BASE_URL = 'http://localhost:8000';

function KioskTest() {
  const [stats, setStats] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState(null);

  // 통계 및 기록 조회
  const fetchData = async () => {
    try {
      setError(null);
      const [statsRes, recordsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/kiosk/stats`).catch(() => null),
        fetch(`${API_BASE_URL}/api/kiosk/attendance/today`).catch(() => null)
      ]);

      if (statsRes && statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (recordsRes && recordsRes.ok) {
        const recordsData = await recordsRes.json();
        setRecords(recordsData);
      }

      setLoading(false);
    } catch (err) {
      console.error('데이터 조회 실패:', err);
      setError('서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인하세요.');
      setLoading(false);
    }
  };

  // 테스트 데이터 전송
  const sendTestData = async (type = 'attendance') => {
    const testData = {
      id: Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      data: {
        studentId: `TEST${Math.floor(Math.random() * 100)}`,
        studentName: `테스트학생${Math.floor(Math.random() * 10)}`,
        fingerprint: 'test_fingerprint_hash',
        type: type,
        deviceId: 'kiosk_test_001'
      },
      synced: false,
      source: 'web-test-dashboard'
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/kiosk/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      setTestResult({
        success: true,
        message: `${getTypeLabel(type)} 테스트 성공!`,
        data: result
      });

      // 데이터 새로고침
      setTimeout(fetchData, 500);
    } catch (err) {
      setTestResult({
        success: false,
        message: '테스트 실패: ' + err.message
      });
    }
  };

  const getTypeLabel = (type) => {
    const labels = {
      attendance: '출석(등원)',
      outing: '외출',
      return: '복귀',
      exit: '퇴장(하원)'
    };
    return labels[type] || type;
  };

  const getTypeBadgeClass = (type) => {
    const classes = {
      attendance: 'bg-green-100 text-green-800',
      outing: 'bg-yellow-100 text-yellow-800',
      return: 'bg-blue-100 text-blue-800',
      exit: 'bg-red-100 text-red-800'
    };
    return classes[type] || 'bg-gray-100 text-gray-800';
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ fontSize: '20px' }}>로딩 중...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', padding: '24px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

        {/* 헤더 */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '36px', fontWeight: 'bold', color: '#111', marginBottom: '8px' }}>
            🔌 키오스크 웹훅 테스트 대시보드
          </h1>
          <p style={{ color: '#666' }}>
            클래스업 키오스크 출석 데이터 연동 확인
          </p>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '8px' }}>
            <div style={{ fontWeight: 'bold', color: '#c00' }}>⚠️ {error}</div>
            <div style={{ marginTop: '8px', fontSize: '14px', color: '#666' }}>
              백엔드 서버 실행: <code>cd C:\Dittonweb\backend && uvicorn main:app --reload --port 8000</code>
            </div>
          </div>
        )}

        {/* 테스트 결과 알림 */}
        {testResult && (
          <div style={{
            marginBottom: '24px',
            padding: '16px',
            backgroundColor: testResult.success ? '#d4edda' : '#f8d7da',
            border: `1px solid ${testResult.success ? '#c3e6cb' : '#f5c6cb'}`,
            borderRadius: '8px'
          }}>
            <div style={{ fontWeight: 'bold', color: testResult.success ? '#155724' : '#721c24' }}>
              {testResult.message}
            </div>
          </div>
        )}

        {/* 통계 카드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          <StatCard label="전체 기록" value={stats?.total_records || 0} color="#333" />
          <StatCard label="오늘" value={stats?.today_records || 0} color="#2563eb" />
          <StatCard label="출석(등원)" value={stats?.attendance_count || 0} color="#16a34a" />
          <StatCard label="외출" value={stats?.outing_count || 0} color="#ca8a04" />
          <StatCard label="복귀" value={stats?.return_count || 0} color="#0284c7" />
          <StatCard label="퇴장(하원)" value={stats?.exit_count || 0} color="#dc2626" />
        </div>

        {/* 테스트 버튼 */}
        <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>🧪 웹훅 테스트</h2>
          <p style={{ color: '#666', marginBottom: '16px' }}>버튼을 클릭하여 테스트 데이터를 전송하세요</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <button
              onClick={() => sendTestData('attendance')}
              style={{ padding: '12px 24px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
            >
              ✅ 출석(등원) 테스트
            </button>

            <button
              onClick={() => sendTestData('outing')}
              style={{ padding: '12px 24px', backgroundColor: '#ca8a04', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
            >
              🚶 외출 테스트
            </button>

            <button
              onClick={() => sendTestData('return')}
              style={{ padding: '12px 24px', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
            >
              🔙 복귀 테스트
            </button>

            <button
              onClick={() => sendTestData('exit')}
              style={{ padding: '12px 24px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
            >
              👋 퇴장(하원) 테스트
            </button>
          </div>
        </div>

        {/* 오늘의 출석 기록 */}
        <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>📋 오늘의 출석 기록</h2>
            <button
              onClick={fetchData}
              style={{ padding: '8px 16px', backgroundColor: '#f3f4f6', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              🔄 새로고침
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#f9fafb' }}>
                <tr>
                  <th style={tableHeaderStyle}>ID</th>
                  <th style={tableHeaderStyle}>학생 ID</th>
                  <th style={tableHeaderStyle}>학생 이름</th>
                  <th style={tableHeaderStyle}>유형</th>
                  <th style={tableHeaderStyle}>기기 ID</th>
                  <th style={tableHeaderStyle}>시간</th>
                  <th style={tableHeaderStyle}>출처</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '48px', textAlign: 'center', color: '#9ca3af' }}>
                      오늘 출석 기록이 없습니다.
                      <br />
                      <span style={{ fontSize: '14px' }}>위의 테스트 버튼을 눌러 테스트 데이터를 생성하세요.</span>
                    </td>
                  </tr>
                ) : (
                  records.map((record) => (
                    <tr key={record.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={tableCellStyle}>#{record.id}</td>
                      <td style={tableCellStyle}>{record.student_id || '-'}</td>
                      <td style={{ ...tableCellStyle, fontWeight: '500' }}>{record.student_name || '-'}</td>
                      <td style={tableCellStyle}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '9999px',
                          fontSize: '12px',
                          fontWeight: '600',
                          ...getBadgeStyle(record.attendance_type)
                        }}>
                          {getTypeLabel(record.attendance_type)}
                        </span>
                      </td>
                      <td style={{ ...tableCellStyle, color: '#6b7280' }}>{record.device_id || '-'}</td>
                      <td style={{ ...tableCellStyle, color: '#6b7280' }}>
                        {new Date(record.received_at).toLocaleString('ko-KR')}
                      </td>
                      <td style={{ ...tableCellStyle, color: '#6b7280' }}>{record.source}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* API 정보 */}
        <div style={{ marginTop: '32px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e40af', marginBottom: '12px' }}>📡 API 엔드포인트</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
            <div>
              <code style={{ backgroundColor: 'white', padding: '4px 8px', borderRadius: '4px', color: '#2563eb' }}>
                POST {API_BASE_URL}/api/kiosk/attendance
              </code>
              <span style={{ marginLeft: '8px', color: '#374151' }}>- 웹훅 수신</span>
            </div>
            <div>
              <code style={{ backgroundColor: 'white', padding: '4px 8px', borderRadius: '4px', color: '#2563eb' }}>
                GET {API_BASE_URL}/api/kiosk/stats
              </code>
              <span style={{ marginLeft: '8px', color: '#374151' }}>- 통계 조회</span>
            </div>
            <div>
              <code style={{ backgroundColor: 'white', padding: '4px 8px', borderRadius: '4px', color: '#2563eb' }}>
                GET {API_BASE_URL}/api/kiosk/attendance/today
              </code>
              <span style={{ marginLeft: '8px', color: '#374151' }}>- 오늘 기록</span>
            </div>
          </div>

          <div style={{ marginTop: '16px', padding: '16px', backgroundColor: 'white', border: '1px solid #bfdbfe', borderRadius: '4px' }}>
            <p style={{ fontSize: '14px', color: '#374151', fontWeight: '500', marginBottom: '8px' }}>
              프록시 서버 설정 (enhanced-proxy.js):
            </p>
            <code style={{ fontSize: '12px', color: '#1f2937' }}>
              YOUR_WEBHOOK_URL: '{API_BASE_URL}/api/kiosk/attendance'
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}

// 통계 카드 컴포넌트
function StatCard({ label, value, color }) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px' }}>
      <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '36px', fontWeight: 'bold', color: color }}>{value}</div>
    </div>
  );
}

// 스타일 상수
const tableHeaderStyle = {
  padding: '12px 24px',
  textAlign: 'left',
  fontSize: '12px',
  fontWeight: '500',
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
};

const tableCellStyle = {
  padding: '16px 24px',
  fontSize: '14px',
  color: '#111'
};

function getBadgeStyle(type) {
  const styles = {
    attendance: { backgroundColor: '#dcfce7', color: '#166534' },
    outing: { backgroundColor: '#fef9c3', color: '#854d0e' },
    return: { backgroundColor: '#dbeafe', color: '#1e40af' },
    exit: { backgroundColor: '#fee2e2', color: '#991b1b' }
  };
  return styles[type] || { backgroundColor: '#f3f4f6', color: '#374151' };
}

export default KioskTest;
