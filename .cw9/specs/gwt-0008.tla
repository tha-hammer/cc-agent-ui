---- MODULE GWT0008ForkSessionId ----

EXTENDS TLC

CONSTANTS UUID_A, UUID_B

(*--algorithm GWT0008ForkSessionId

variables
    sessionIdPresent    \in BOOLEAN,
    forkSessionTrue     \in BOOLEAN,
    resumePresent       \in BOOLEAN,
    out_sessionId_set   = FALSE,
    out_forkSession_set = FALSE,
    out_resume_set      = FALSE,
    phase               = "Init";

define

    SessionIdGatedByFork ==
        out_sessionId_set =>
            (forkSessionTrue /\ sessionIdPresent)

    NoLeakWithoutFork ==
        (sessionIdPresent /\ ~forkSessionTrue) => ~out_sessionId_set

    ForkFieldPropagated ==
        out_sessionId_set => out_forkSession_set

    LegacyResumePreserved ==
        (phase = "Complete" /\ sessionIdPresent /\ ~forkSessionTrue) =>
            out_resume_set

    AllInvariants ==
        /\ SessionIdGatedByFork
        /\ NoLeakWithoutFork
        /\ ForkFieldPropagated
        /\ LegacyResumePreserved

end define;

fair process mapper = "mapper"
begin
    MapForkFields:
        if forkSessionTrue /\ sessionIdPresent then
            out_sessionId_set   := TRUE;
            out_forkSession_set := TRUE;
        else
            out_sessionId_set := FALSE;
        end if;
    MapResume:
        if ~forkSessionTrue /\ sessionIdPresent then
            out_resume_set := TRUE;
        elsif resumePresent then
            out_resume_set := TRUE;
        end if;
    Finish:
        phase := "Complete";
end process;

end algorithm; *)
\* BEGIN TRANSLATION (chksum(pcal) = "71364853" /\ chksum(tla) = "72127de6")
VARIABLES pc, sessionIdPresent, forkSessionTrue, resumePresent, 
          out_sessionId_set, out_forkSession_set, out_resume_set, phase

(* define statement *)
SessionIdGatedByFork ==
    out_sessionId_set =>
        (forkSessionTrue /\ sessionIdPresent)

NoLeakWithoutFork ==
    (sessionIdPresent /\ ~forkSessionTrue) => ~out_sessionId_set

ForkFieldPropagated ==
    out_sessionId_set => out_forkSession_set

LegacyResumePreserved ==
    (phase = "Complete" /\ sessionIdPresent /\ ~forkSessionTrue) =>
        out_resume_set

AllInvariants ==
    /\ SessionIdGatedByFork
    /\ NoLeakWithoutFork
    /\ ForkFieldPropagated
    /\ LegacyResumePreserved


vars == << pc, sessionIdPresent, forkSessionTrue, resumePresent, 
           out_sessionId_set, out_forkSession_set, out_resume_set, phase >>

ProcSet == {"mapper"}

Init == (* Global variables *)
        /\ sessionIdPresent \in BOOLEAN
        /\ forkSessionTrue \in BOOLEAN
        /\ resumePresent \in BOOLEAN
        /\ out_sessionId_set = FALSE
        /\ out_forkSession_set = FALSE
        /\ out_resume_set = FALSE
        /\ phase = "Init"
        /\ pc = [self \in ProcSet |-> "MapForkFields"]

MapForkFields == /\ pc["mapper"] = "MapForkFields"
                 /\ IF forkSessionTrue /\ sessionIdPresent
                       THEN /\ out_sessionId_set' = TRUE
                            /\ out_forkSession_set' = TRUE
                       ELSE /\ out_sessionId_set' = FALSE
                            /\ UNCHANGED out_forkSession_set
                 /\ pc' = [pc EXCEPT !["mapper"] = "MapResume"]
                 /\ UNCHANGED << sessionIdPresent, forkSessionTrue, 
                                 resumePresent, out_resume_set, phase >>

MapResume == /\ pc["mapper"] = "MapResume"
             /\ IF ~forkSessionTrue /\ sessionIdPresent
                   THEN /\ out_resume_set' = TRUE
                   ELSE /\ IF resumePresent
                              THEN /\ out_resume_set' = TRUE
                              ELSE /\ TRUE
                                   /\ UNCHANGED out_resume_set
             /\ pc' = [pc EXCEPT !["mapper"] = "Finish"]
             /\ UNCHANGED << sessionIdPresent, forkSessionTrue, resumePresent, 
                             out_sessionId_set, out_forkSession_set, phase >>

Finish == /\ pc["mapper"] = "Finish"
          /\ phase' = "Complete"
          /\ pc' = [pc EXCEPT !["mapper"] = "Done"]
          /\ UNCHANGED << sessionIdPresent, forkSessionTrue, resumePresent, 
                          out_sessionId_set, out_forkSession_set, 
                          out_resume_set >>

mapper == MapForkFields \/ MapResume \/ Finish

(* Allow infinite stuttering to prevent deadlock on termination. *)
Terminating == /\ \A self \in ProcSet: pc[self] = "Done"
               /\ UNCHANGED vars

Next == mapper
           \/ Terminating

Spec == /\ Init /\ [][Next]_vars
        /\ WF_vars(mapper)

Termination == <>(\A self \in ProcSet: pc[self] = "Done")

\* END TRANSLATION 

\* GWT0008ForkSessionId.cfg
\* CONSTANT UUID_A = "uuid-a"
\* CONSTANT UUID_B = "uuid-b"
\* SPECIFICATION Spec
\* INVARIANT SessionIdGatedByFork
\* INVARIANT NoLeakWithoutFork
\* INVARIANT ForkFieldPropagated
\* INVARIANT LegacyResumePreserved

====
