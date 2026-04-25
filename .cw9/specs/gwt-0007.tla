---- MODULE Gwt0007ForwardResumeSessionAt ----

EXTENDS Integers, TLC

CONSTANTS
    AssistantUuid,
    OtherFieldSentinel

(* --algorithm ForwardResumeSessionAt

variables
    inputKind \in {"uuid", "empty", "absent"},
    phase = "Init",
    resumeAtSet = FALSE,
    resumeAtValue = "",
    otherFieldValue = OtherFieldSentinel;

define

    ResumeAtForwarded ==
        (phase = "Mapped" /\ inputKind = "uuid") =>
            (resumeAtSet = TRUE /\ resumeAtValue = AssistantUuid)

    ResumeAtAbsent ==
        (phase = "Mapped" /\ inputKind \in {"empty", "absent"}) =>
            resumeAtSet = FALSE

    StringIdentity ==
        resumeAtSet = TRUE =>
            resumeAtValue = AssistantUuid

    NoClobber ==
        otherFieldValue = OtherFieldSentinel

    AllInvariants ==
        ResumeAtForwarded /\ ResumeAtAbsent /\ StringIdentity /\ NoClobber

end define;

fair process mapper = "mapper"
begin
    MapOptions:
        if inputKind = "uuid" then
            resumeAtSet := TRUE;
            resumeAtValue := AssistantUuid;
        else
            resumeAtSet := FALSE;
            resumeAtValue := "";
        end if;
    SetPhase:
        phase := "Mapped";
    Terminate:
        skip;
end process;

end algorithm; *)
\* BEGIN TRANSLATION (chksum(pcal) = "a4de5250" /\ chksum(tla) = "bf2045ab")
VARIABLES pc, inputKind, phase, resumeAtSet, resumeAtValue, otherFieldValue

(* define statement *)
ResumeAtForwarded ==
    (phase = "Mapped" /\ inputKind = "uuid") =>
        (resumeAtSet = TRUE /\ resumeAtValue = AssistantUuid)

ResumeAtAbsent ==
    (phase = "Mapped" /\ inputKind \in {"empty", "absent"}) =>
        resumeAtSet = FALSE

StringIdentity ==
    resumeAtSet = TRUE =>
        resumeAtValue = AssistantUuid

NoClobber ==
    otherFieldValue = OtherFieldSentinel

AllInvariants ==
    ResumeAtForwarded /\ ResumeAtAbsent /\ StringIdentity /\ NoClobber


vars == << pc, inputKind, phase, resumeAtSet, resumeAtValue, otherFieldValue
        >>

ProcSet == {"mapper"}

Init == (* Global variables *)
        /\ inputKind \in {"uuid", "empty", "absent"}
        /\ phase = "Init"
        /\ resumeAtSet = FALSE
        /\ resumeAtValue = ""
        /\ otherFieldValue = OtherFieldSentinel
        /\ pc = [self \in ProcSet |-> "MapOptions"]

MapOptions == /\ pc["mapper"] = "MapOptions"
              /\ IF inputKind = "uuid"
                    THEN /\ resumeAtSet' = TRUE
                         /\ resumeAtValue' = AssistantUuid
                    ELSE /\ resumeAtSet' = FALSE
                         /\ resumeAtValue' = ""
              /\ pc' = [pc EXCEPT !["mapper"] = "SetPhase"]
              /\ UNCHANGED << inputKind, phase, otherFieldValue >>

SetPhase == /\ pc["mapper"] = "SetPhase"
            /\ phase' = "Mapped"
            /\ pc' = [pc EXCEPT !["mapper"] = "Terminate"]
            /\ UNCHANGED << inputKind, resumeAtSet, resumeAtValue, 
                            otherFieldValue >>

Terminate == /\ pc["mapper"] = "Terminate"
             /\ TRUE
             /\ pc' = [pc EXCEPT !["mapper"] = "Done"]
             /\ UNCHANGED << inputKind, phase, resumeAtSet, resumeAtValue, 
                             otherFieldValue >>

mapper == MapOptions \/ SetPhase \/ Terminate

(* Allow infinite stuttering to prevent deadlock on termination. *)
Terminating == /\ \A self \in ProcSet: pc[self] = "Done"
               /\ UNCHANGED vars

Next == mapper
           \/ Terminating

Spec == /\ Init /\ [][Next]_vars
        /\ WF_vars(mapper)

Termination == <>(\A self \in ProcSet: pc[self] = "Done")

\* END TRANSLATION 

====
