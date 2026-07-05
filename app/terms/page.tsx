'use client';

import BackButton from '@/components/ui/BackButton';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <BackButton />
          <h1 className="font-bold text-gray-900">Terms and Conditions</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow p-6 md:p-8 prose prose-sm max-w-none">
          <h1 className="text-3xl font-bold mb-4">Terms and Conditions</h1>
          <p className="text-gray-500 text-sm mb-6">Last updated: July 05, 2026</p>

          <p className="mb-4">Please read these terms and conditions carefully before using Our Service.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">Interpretation and Definitions</h2>

          <h3 className="text-xl font-semibold mt-6 mb-3">Interpretation</h3>
          <p className="mb-4">The words whose initial letters are capitalized have meanings defined under the following conditions. The following definitions shall have the same meaning regardless of whether they appear in singular or in plural.</p>

          <h3 className="text-xl font-semibold mt-6 mb-3">Definitions</h3>
          <p className="mb-4">For the purposes of these Terms and Conditions:</p>

          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li><strong>Affiliate</strong> means an entity that controls, is controlled by, or is under common control with a party, where &quot;control&quot; means ownership of 50% or more of the shares, equity interest or other securities entitled to vote for election of directors or other managing authority.</li>
            <li><strong>Country</strong> refers to: <strong>Pakistan</strong>.</li>
            <li><strong>Company</strong> (referred to as either &quot;the Company&quot;, &quot;We&quot;, &quot;Us&quot; or &quot;Our&quot; in these Terms and Conditions) refers to <strong>YouTask</strong>.</li>
            <li><strong>Device</strong> means any device that can access the Service such as a computer, a cell phone or a digital tablet.</li>
            <li><strong>Service</strong> refers to the Website.</li>
            <li><strong>Terms and Conditions</strong> (also referred to as &quot;Terms&quot;) means these Terms and Conditions, which govern Your access to and use of the Service.</li>
            <li><strong>Website</strong> refers to YouTask, accessible from <a href="https://audio-rewards-platform.vercel.app" className="text-purple-600 hover:underline">https://audio-rewards-platform.vercel.app</a>.</li>
            <li><strong>You</strong> means the individual accessing or using the Service.</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4">Acknowledgment</h2>
          <p className="mb-4">These are the Terms and Conditions governing the use of this Service and the agreement between You and the Company. These Terms and Conditions set out the rights and obligations of all users regarding the use of the Service.</p>
          <p className="mb-4">Your access to and use of the Service is conditioned on Your acceptance of and compliance with these Terms and Conditions. These Terms and Conditions apply to all visitors, users and others who access or use the Service.</p>
          <p className="mb-4">By accessing or using the Service You agree to be bound by these Terms and Conditions. If You disagree with any part of these Terms and Conditions then You may not access the Service.</p>
          <p className="mb-4">You represent that you are over the age of 18. The Company does not permit those under 18 to use the Service.</p>
          <p className="mb-4">Your access to and use of the Service is also subject to Our <a href="/privacy-policy" className="text-purple-600 hover:underline">Privacy Policy</a>, which describes how We collect, use, and disclose personal information. Please read Our Privacy Policy carefully before using Our Service.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">User Accounts and Registration</h2>
          <p className="mb-4">To use certain features of the Service, you must register for an account. You agree to provide accurate, current, and complete information during registration. You are solely responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>
          <p className="mb-4"><strong>Strict Account Policy:</strong> Each individual user is permitted to create and maintain only one (1) account. The creation of multiple accounts by the same individual, whether using different emails, automated scripts, or any other method, is strictly prohibited and constitutes a material breach of these Terms.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">User Conduct and Prohibited Activities</h2>
          <p className="mb-4">You agree to use the Service only for lawful purposes and in accordance with these Terms. You are strictly prohibited from engaging in the following actions:</p>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>Using any automated bots, scripts, spiders, scrapers, or other software tools to complete tasks, generate fake traffic, or manipulate the platform's reward mechanisms.</li>
            <li>Creating fake, fraudulent, or artificial referrals to exploit the platform's referral program.</li>
            <li>Attempting to bypass, reverse-engineer, modify, or interfere with any security protocols, payment verifications, or task tracking algorithms of the Website.</li>
            <li>Using Virtual Private Networks (VPNs), proxies, or device emulators to mask your true identity or location while accessing tasks.</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4">Rewards, Earnings, and Payout Rules</h2>
          <p className="mb-4">YouTask offers users the opportunity to earn digital rewards or virtual balances by successfully completing specific audio-related tasks. By participating, you acknowledge and agree to the following payout guidelines:</p>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li><strong>Task Verification:</strong> All submitted audio tasks undergo a automated or manual verification process. Rewards will only be officially credited to your user balance after a task is verified as complete and accurate.</li>
            <li><strong>Forfeiture of Balances:</strong> If the Company detects any fraudulent activity, multiple account usage, bot interaction, or exploitation of bugs, the Company reserves the absolute right to cancel your pending balance, void your earnings, and permanently ban your account without prior notice or liability.</li>
            <li><strong>Withdrawal Processing:</strong> Withdrawal requests are subject to minimum payout thresholds and approval processing times. The Company reserves the right to review any withdrawal requests for security compliance before releasing funds.</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4">Links to Other Websites</h2>
          <p className="mb-4">Our Service may contain links to third-party websites or services that are not owned or controlled by the Company.</p>
          <p className="mb-4">The Company has no control over, and assumes no responsibility for, the content, privacy policies, or practices of any third-party websites or services. You further acknowledge and agree that the Company shall not be responsible or liable, directly or indirectly, for any damage or loss caused or alleged to be caused by or in connection with the use of or reliance on any such content, goods or services available on or through any such websites or services.</p>
          <p className="mb-4">We strongly advise You to read the terms and conditions and privacy policies of any third-party websites or services that You visit.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">Termination</h2>
          <p className="mb-4">We may terminate or suspend Your access immediately, without prior notice or liability, for any reason whatsoever, including without limitation if You breach these Terms and Conditions.</p>
          <p className="mb-4">Upon termination, Your right to use the Service will cease immediately.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">Limitation of Liability</h2>
          <p className="mb-4">Notwithstanding any damages that You might incur, the entire liability of the Company and any of its suppliers under any provision of these Terms and Your exclusive remedy for all of the foregoing shall be limited to the amount actually paid by You through the Service or 100 USD if You haven't purchased anything through the Service.</p>
          <p className="mb-4">To the maximum extent permitted by applicable law, in no event shall the Company or its suppliers be liable for any special, incidental, indirect, or consequential damages whatsoever (including, but not limited to, damages for loss of profits, loss of data or other information, for business interruption, for personal injury, loss of privacy arising out of or in any way related to the use of or inability to use the Service, third-party software and/or third-party hardware used with the Service, or otherwise in connection with any provision of these Terms), even if the Company or any supplier has been advised of the possibility of such damages and even if the remedy fails of its essential purpose.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">&quot;AS IS&quot; and &quot;AS AVAILABLE&quot; Disclaimer</h2>
          <p className="mb-4">The Service is provided to You &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; and with all faults and defects without warranty of any kind. To the maximum extent permitted under applicable law, the Company, on its own behalf and on behalf of its Affiliates and its and their respective licensors and service providers, expressly disclaims all warranties, whether express, implied, statutory or otherwise, with respect to the Service, including all implied warranties of merchantability, fitness for a particular purpose, title and non-infringement, and warranties that may arise out of course of dealing, course of performance, usage or trade practice.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">Governing Law</h2>
          <p className="mb-4">The laws of the Country, excluding its conflicts of law rules, shall govern these Terms and Your use of the Service. Your use of the Application may also be subject to other local, state, national, or international laws.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">Disputes Resolution</h2>
          <p className="mb-4">If You have any concern or dispute about the Service, You agree to first try to resolve the dispute informally by contacting the Company.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">Changes to These Terms and Conditions</h2>
          <p className="mb-4">We reserve the right, at Our sole discretion, to modify or replace these Terms at any time. If a revision is material We will make reasonable efforts to provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at Our sole discretion.</p>
          <p className="mb-4">By continuing to access or use Our Service after those revisions become effective, You agree to be bound by the revised terms. If You do not agree to the new terms, in whole or in part, please stop using the Service.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">Contact Us</h2>
          <p className="mb-4">If you have any questions about these Terms and Conditions, You can contact us:</p>
          <ul className="list-disc pl-6">
            <li>By email: <a href="mailto:awaisealtaf@gmail.com" className="text-purple-600 hover:underline">awaisealtaf@gmail.com</a></li>
          </ul>
        </div>
      </div>
    </div>
  );
}